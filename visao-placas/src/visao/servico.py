"""
Serviço de identificação por software (docs/plano_identificacao_placas_software.md, seção 6).

Lê do sistema as câmeras com a identificação por software ligada e a configuração desenhada no cadastro (linha
virtual e área), assiste ao vídeo de cada uma numa thread própria e envia ao backend dois eventos por veículo:
"leitura", quando a placa fica estável, e "passagem", quando o veículo cruza a linha (ou sai sem cruzar, se a placa
já tinha sido avisada). Ligar ou desligar uma câmera no cadastro tem efeito em até 1 minuto, sem reiniciar.

    python -m visao.servico
"""

import json
import logging
import os
import queue
import threading
import time
import urllib.parse

import numpy as np

from .captura import quadros
from .detector import DetectorVeiculos
from .leitor_placas import LeitorPlacas
from .linha import Linha
from .main import dentro_da_area
from .passagens import Passagens
from .rastreador import Rastreador
from .sistema import LARGURA_FOTO, Backend, ErroBackend, FilaEventos, imagem_base64, iso

log = logging.getLogger("visao.servico")

MODELO_VEICULOS = os.environ.get("VISAO_MODELO", "/modelos/yolox_tiny.onnx")
INTERVALO_CONFIG = 60
INTERVALO_STATUS = 300


def url_rtsp(camera, canal):
    host = str(camera["url"]).split(":")[0]
    usuario = urllib.parse.quote(camera.get("login") or "admin", safe="")
    senha = urllib.parse.quote(camera.get("senha") or "", safe="")
    return f"rtsp://{usuario}:{senha}@{host}:554/Streaming/Channels/{canal}"


def assinatura(camera):
    """Muda quando algo que exige reiniciar a thread da câmera muda no cadastro."""
    return json.dumps({k: camera.get(k) for k in ("url", "login", "senha", "sentido", "config_software")},
                      sort_keys=True)


class TrabalhadorCamera(threading.Thread):
    def __init__(self, camera, fila):
        super().__init__(daemon=True, name=f"camera-{camera['id']}")
        self.camera = camera
        self.fila = fila
        self.parada = threading.Event()
        self.quadros = 0
        self.descartados = 0
        self.tempo_medio_ms = 0.0
        self.leituras = 0
        self.passagens = 0

    def parar(self):
        self.parada.set()

    def _montar(self):
        cfg = self.camera["config_software"]
        lc = cfg["linha"]
        linha = Linha(lc["p1"], lc["p2"], lc["ponto_dentro"], lc.get("margem", 15))
        qps = float(cfg.get("qps", 5))
        detector = DetectorVeiculos(MODELO_VEICULOS, confianca=float(cfg.get("detector", {}).get("confianca", 0.25)),
                                    threads=2)
        leitor = LeitorPlacas(threads=1)
        passagens = Passagens(linha, tempo_perdido=3.0, max_tentativas_placa=15, confianca_placa=0.5,
                              area_minima_placa=20000, modo_ancora=lc.get("ancora", "centro"))
        rastreador = Rastreador(iou_minimo=0.25, quadros_perdido=int(3.0 * qps))
        area = np.array(cfg["area"], dtype=np.int32) if cfg.get("area") else None
        return qps, detector, leitor, passagens, rastreador, area

    def _rastro(self, inicio, id_):
        return f"{self.camera['id']}-{int(inicio * 1000)}-{id_}"

    def _evento_leitura(self, l):
        return {
            "camera_id": self.camera["id"], "rastro": self._rastro(l.inicio, l.rastro), "inicio": iso(l.inicio),
            "placa": l.placa, "confianca": l.confianca, "leituras": l.leituras_placa, "classe": l.classe,
            "foto": imagem_base64(l.foto, LARGURA_FOTO, l.foto_caixa), "foto_placa": imagem_base64(l.recorte_placa),
        }

    def _evento_passagem(self, p):
        evento = {
            "camera_id": self.camera["id"], "rastro": self._rastro(p.inicio, p.rastro), "inicio": iso(p.inicio),
            "instante": iso(p.instante), "direcao": p.direcao, "placa": p.placa,
            "confianca": p.confianca if p.placa else None, "leituras": p.leituras_placa, "classe": p.classe,
        }
        # a foto já foi junto com a leitura, a não ser que a placa tenha mudado depois ou nunca tenha sido avisada
        if p.placa != p.placa_enviada:
            evento["foto"] = imagem_base64(p.foto, LARGURA_FOTO, p.foto_caixa)
            evento["foto_placa"] = imagem_base64(p.recorte_placa)
        return evento

    def run(self):
        try:
            qps, detector, leitor, passagens, rastreador, area = self._montar()
        except Exception:  # noqa: BLE001 - configuração ruim não pode derrubar as outras câmeras
            log.exception("câmera %s: configuração inválida", self.camera["id"])
            return
        canal = self.camera["config_software"].get("canal", 101)
        log.info("câmera %s (%s): iniciando, canal %s, %.0f qps", self.camera["id"], self.camera.get("nome"), canal, qps)
        recentes = queue.Queue(maxsize=10)

        def decodificar():
            for item in quadros(url_rtsp(self.camera, canal), qps, parar=self.parada.is_set):
                if recentes.full():
                    try:
                        recentes.get_nowait()
                        self.descartados += 1
                    except queue.Empty:
                        pass
                recentes.put(item)

        threading.Thread(target=decodificar, daemon=True, name=f"video-{self.camera['id']}").start()
        tempos = []
        while not self.parada.is_set():
            try:
                instante, quadro = recentes.get(timeout=1)
            except queue.Empty:
                continue
            t0 = time.time()
            deteccoes = [d for d in detector.detectar(quadro) if dentro_da_area(area, d[:4])]
            veiculos = rastreador.atualizar(deteccoes)
            prontas = passagens.atualizar(instante, veiculos, quadro)
            for id_, caixa, _ in veiculos:
                if passagens.deve_ler_placa(id_, caixa):
                    passagens.registrar_placa(id_, leitor.ler(quadro, caixa), quadro, caixa)
            for leitura in passagens.leituras_estaveis():
                self.fila.colocar("leitura", self._evento_leitura(leitura))
                self.leituras += 1
            for passagem in prontas:
                self.fila.colocar("passagem", self._evento_passagem(passagem))
                self.passagens += 1
                log.info("câmera %s: %s %s placa=%s", self.camera["id"], passagem.direcao, passagem.classe,
                         passagem.placa)
            self.quadros += 1
            tempos.append((time.time() - t0) * 1000)
            if len(tempos) >= 50:
                self.tempo_medio_ms = round(sum(tempos) / len(tempos), 1)
                tempos.clear()
        for passagem in passagens.fechar_todos(time.time() + 3600):
            self.fila.colocar("passagem", self._evento_passagem(passagem))
        log.info("câmera %s: parada", self.camera["id"])


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    dados = os.environ.get("VISAO_DADOS", "/data")
    os.makedirs(dados, exist_ok=True)
    backend = Backend(os.environ["DIGICAM_BACKEND_URL"], os.environ["DIGICAM_SERVICO_EMAIL"],
                      os.environ["DIGICAM_SERVICO_SENHA"])
    fila = FilaEventos(os.path.join(dados, "fila_eventos.db"), backend)
    parada = threading.Event()
    threading.Thread(target=fila.rodar, args=(parada.is_set,), daemon=True, name="envio").start()

    trabalhadores = {}  # id da câmera -> (assinatura, thread)
    ultimo_status = 0.0
    while True:
        try:
            cameras = {c["id"]: c for c in backend.cameras() if c.get("config_software")}
        except ErroBackend as erro:
            log.warning("não consegui ler as câmeras do sistema (%s); mantendo as atuais", erro)
            cameras = None
        if cameras is not None:
            for id_ in list(trabalhadores):
                ass, t = trabalhadores[id_]
                if id_ not in cameras or assinatura(cameras[id_]) != ass or not t.is_alive():
                    t.parar()
                    t.join(timeout=10)
                    del trabalhadores[id_]
                    if id_ not in cameras:
                        log.info("câmera %s: identificação por software desligada no cadastro", id_)
            for id_, camera in cameras.items():
                if id_ not in trabalhadores:
                    t = TrabalhadorCamera(camera, fila)
                    t.start()
                    trabalhadores[id_] = (assinatura(camera), t)
        if time.time() - ultimo_status > INTERVALO_STATUS:
            ultimo_status = time.time()
            for id_, (_, t) in trabalhadores.items():
                log.info("status câmera %s: %d quadros, %.0f ms/quadro, %d descartados, %d leituras, %d passagens",
                         id_, t.quadros, t.tempo_medio_ms, t.descartados, t.leituras, t.passagens)
            log.info("status envio: %d enviados, %d falhas, %d na fila%s", fila.enviados, fila.falhas,
                     fila.pendentes(), f", último erro: {fila.ultimo_erro}" if fila.ultimo_erro else "")
        time.sleep(INTERVALO_CONFIG)


if __name__ == "__main__":
    main()
