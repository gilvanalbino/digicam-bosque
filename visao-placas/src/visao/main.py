"""
Protótipo da segunda camada de identificação: assiste ao vídeo de uma câmera, registra cada veículo que cruza a
linha virtual (entrada ou saída) com foto e, quando consegue, a placa; compara com o que a câmera registrou.

Ao vivo:   python -m visao.main
Arquivo:   python -m visao.main --arquivo video.mp4 --inicio 2026-11-16T17:57:00-03:00 --dados /tmp/saida
"""

import argparse
import logging
import os
import queue
import threading
import time
from datetime import datetime

import numpy as np
import yaml

from .armazenamento import Armazenamento
from .captura import quadros
from .detector import DetectorVeiculos
from .leitor_placas import LeitorPlacas
from .linha import Linha
from .passagens import Passagens
from .rastreador import Rastreador

log = logging.getLogger("visao")


class Estado:
    """Números de funcionamento mostrados na página (/api/status)."""

    def __init__(self):
        self.inicio = time.time()
        self.quadros = 0
        self.descartados = 0
        self.ultimo_quadro = None
        self.atraso_ms = 0.0
        self.tempo_medio_ms = 0.0
        self.passagens = 0
        self.ultima_comparacao = None
        self.erro_comparacao = None

    def como_dict(self):
        return {k: v for k, v in self.__dict__.items()}


def carregar_config(caminho):
    with open(caminho, encoding="utf-8") as f:
        return yaml.safe_load(f)


def montar(config, dados):
    linha_cfg = config["linha"]
    linha = Linha(linha_cfg["p1"], linha_cfg["p2"], linha_cfg["ponto_dentro"], linha_cfg.get("margem", 15))
    det_cfg = config.get("detector", {})
    detector = DetectorVeiculos(
        config.get("modelo_veiculos", "/modelos/yolox_tiny.onnx"),
        tamanho=det_cfg.get("tamanho", 416),
        confianca=det_cfg.get("confianca", 0.35),
        threads=det_cfg.get("threads", 2),
    )
    placa_cfg = config.get("placa", {})
    leitor = LeitorPlacas(threads=placa_cfg.get("threads", 1))
    passagens = Passagens(
        linha,
        tempo_perdido=config.get("tempo_perdido", 3.0),
        max_tentativas_placa=placa_cfg.get("max_tentativas", 15),
        confianca_placa=placa_cfg.get("confianca_minima", 0.5),
        area_minima_placa=placa_cfg.get("area_minima_veiculo", 0),
        modo_ancora=linha_cfg.get("ancora", "base"),
    )
    qps = config.get("qps", 5.0)
    rastreador = Rastreador(iou_minimo=config.get("iou_minimo", 0.25),
                            quadros_perdido=int(config.get("tempo_perdido", 3.0) * qps))
    area = config.get("area")
    area = np.array(area, dtype=np.int32) if area else None
    retencao = config.get("retencao", {})
    armazenamento = Armazenamento(dados, limite_bytes=int(retencao.get("limite_gb", 2) * 1024**3),
                                  dias=retencao.get("dias", 15))
    return linha, detector, leitor, passagens, rastreador, area, armazenamento


def dentro_da_area(area, caixa):
    if area is None:
        return True
    import cv2

    x1, _, x2, y2 = caixa
    return cv2.pointPolygonTest(area, ((x1 + x2) / 2, y2), False) >= 0


def processar(fonte, config, componentes, estado, parar):
    _, detector, leitor, passagens, rastreador, area, armazenamento = componentes
    camera_id = config["camera_id"]
    tempos = []
    for instante, quadro in fonte:
        if parar():
            break
        t0 = time.time()
        deteccoes = [d for d in detector.detectar(quadro) if dentro_da_area(area, d[:4])]
        veiculos = rastreador.atualizar(deteccoes)
        prontas = passagens.atualizar(instante, veiculos, quadro)
        for id_, caixa, _ in veiculos:
            if passagens.deve_ler_placa(id_, caixa):
                passagens.registrar_placa(id_, leitor.ler(quadro, caixa), quadro, caixa)
        for p in prontas:
            pid = armazenamento.gravar(camera_id, p)
            estado.passagens += 1
            log.info("passagem %d: %s %s placa=%s conf=%.2f (%d/%d leituras, %d tentativas) às %s",
                     pid, p.direcao, p.classe, p.placa, p.confianca, p.leituras_placa, p.leituras_validas,
                     p.tentativas_placa, datetime.fromtimestamp(p.instante).strftime("%H:%M:%S"))
        estado.quadros += 1
        estado.ultimo_quadro = instante
        estado.atraso_ms = round((time.time() - instante) * 1000, 1)
        tempos.append((time.time() - t0) * 1000)
        if len(tempos) >= 50:
            estado.tempo_medio_ms = round(sum(tempos) / len(tempos), 1)
            tempos.clear()
    for p in passagens.fechar_todos(time.time() + 3600):
        armazenamento.gravar(camera_id, p)
        estado.passagens += 1


def fila_ao_vivo(gerador, estado, parar, tamanho=10):
    """
    Decodifica em uma thread própria e entrega só os quadros recentes: se o processamento atrasar, os quadros
    mais antigos são descartados, para o vídeo da câmera nunca acumular atraso.
    """
    fila = queue.Queue(maxsize=tamanho)

    def ler():
        for item in gerador:
            if fila.full():
                try:
                    fila.get_nowait()
                    estado.descartados += 1
                except queue.Empty:
                    pass
            fila.put(item)

    threading.Thread(target=ler, daemon=True, name="captura").start()
    while not parar():
        try:
            yield fila.get(timeout=1)
        except queue.Empty:
            continue


def conexao_mysql():
    import pymysql

    return pymysql.connect(
        host=os.environ.get("DATABASE_HOST", "mysql"),
        user=os.environ["DATABASE_USER"],
        password=os.environ["DATABASE_PASS"],
        database=os.environ["DATABASE_NAME"],
        connect_timeout=10,
        init_command="SET time_zone='+00:00'",
    )


def tarefas_periodicas(config, armazenamento, estado, parar):
    from .comparacao import Comparacao

    comparacao = Comparacao(armazenamento, conexao_mysql, config["camera_id"], config["portaria_id"],
                            tolerancia=config.get("comparacao", {}).get("tolerancia_s", 20.0),
                            desde=estado.inicio)
    ultima_limpeza = 0.0
    while not parar():
        try:
            comparacao.executar()
            estado.ultima_comparacao = time.time()
            estado.erro_comparacao = None
        except Exception as erro:  # noqa: BLE001 - o banco do HML fora do ar não para o protótipo
            estado.erro_comparacao = str(erro)
            log.warning("comparação falhou: %s", erro)
        if time.time() - ultima_limpeza > 600:
            apagados = armazenamento.limpar()
            ultima_limpeza = time.time()
            if apagados:
                log.info("retenção: %d fotos apagadas", apagados)
        for _ in range(60):
            if parar():
                return
            time.sleep(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=os.environ.get("VISAO_CONFIG", "/app/config.yaml"))
    parser.add_argument("--dados", default=os.environ.get("VISAO_DADOS", "/data"))
    parser.add_argument("--arquivo", help="processa um vídeo gravado em vez da câmera ao vivo")
    parser.add_argument("--inicio", help="horário do início do vídeo gravado (ISO 8601)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    config = carregar_config(args.config)
    componentes = montar(config, args.dados)
    armazenamento = componentes[-1]
    estado = Estado()
    parada = threading.Event()

    if args.arquivo:
        inicio = datetime.fromisoformat(args.inicio).timestamp() if args.inicio else 0.0
        fonte = quadros(args.arquivo, config.get("qps", 5.0), arquivo=True, inicio_arquivo=inicio)
        t0 = time.time()
        processar(fonte, config, componentes, estado, parada.is_set)
        log.info("arquivo processado: %d quadros, %d passagens em %.0f s", estado.quadros, estado.passagens,
                 time.time() - t0)
        return

    url = os.environ["CAMERA_URL"]
    fonte = fila_ao_vivo(quadros(url, config.get("qps", 5.0), parar=parada.is_set), estado, parada.is_set)
    threading.Thread(target=processar, args=(fonte, config, componentes, estado, parada.is_set),
                     daemon=True, name="processamento").start()
    threading.Thread(target=tarefas_periodicas, args=(config, armazenamento, estado, parada.is_set),
                     daemon=True, name="periodicas").start()

    import uvicorn

    from .web import criar_app

    uvicorn.run(criar_app(armazenamento, estado, config), host="0.0.0.0", port=8090, log_level="warning")
    parada.set()


if __name__ == "__main__":
    main()
