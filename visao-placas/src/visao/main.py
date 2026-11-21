"""
Análise de um vídeo gravado com a mesma lógica do serviço: registra cada veículo que cruza a linha virtual com foto
e placa em SQLite, para calibrar a linha e os limiares de uma câmera fora do ar. O serviço ao vivo é visao.servico.

    python -m visao.main --config config.yaml --arquivo video.mp4 --inicio 2026-11-16T17:57:00-03:00 --dados /tmp/saida
"""

import argparse
import logging
import os
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=os.environ.get("VISAO_CONFIG", "/app/config.yaml"))
    parser.add_argument("--dados", default=os.environ.get("VISAO_DADOS", "/data"))
    parser.add_argument("--arquivo", required=True, help="vídeo gravado a analisar")
    parser.add_argument("--inicio", help="horário do início do vídeo gravado (ISO 8601)")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    config = carregar_config(args.config)
    componentes = montar(config, args.dados)
    estado = Estado()
    inicio = datetime.fromisoformat(args.inicio).timestamp() if args.inicio else 0.0
    fonte = quadros(args.arquivo, config.get("qps", 5.0), arquivo=True, inicio_arquivo=inicio)
    t0 = time.time()
    processar(fonte, config, componentes, estado, lambda: False)
    log.info("arquivo processado: %d quadros, %d passagens em %.0f s", estado.quadros, estado.passagens,
             time.time() - t0)


if __name__ == "__main__":
    main()
