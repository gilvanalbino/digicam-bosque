"""Leitura de placa no recorte do veículo com fast-alpr (detector open-image-models + OCR fast-plate-ocr, MIT)."""

import onnxruntime as ort
from fast_alpr import ALPR

DETECTOR_PADRAO = "yolo-v9-t-384-license-plate-end2end"
OCR_PADRAO = "cct-xs-v2-global-model"


class LeitorPlacas:
    def __init__(self, detector=DETECTOR_PADRAO, ocr=OCR_PADRAO, threads=1, confianca_detector=0.4):
        opcoes = ort.SessionOptions()
        opcoes.intra_op_num_threads = threads
        opcoes.inter_op_num_threads = 1
        self.alpr = ALPR(
            detector_model=detector,
            detector_conf_thresh=confianca_detector,
            detector_providers=["CPUExecutionProvider"],
            detector_sess_options=opcoes,
            ocr_model=ocr,
            ocr_device="cpu",
            ocr_providers=["CPUExecutionProvider"],
        )

    def ler(self, quadro, caixa, margem=0.1):
        """Lista de (texto, confiança, recorte da placa) encontradas dentro da caixa do veículo."""
        altura, largura = quadro.shape[:2]
        x1, y1, x2, y2 = caixa
        mx, my = (x2 - x1) * margem, (y2 - y1) * margem
        x1, y1 = int(max(0, x1 - mx)), int(max(0, y1 - my))
        x2, y2 = int(min(largura, x2 + mx)), int(min(altura, y2 + my))
        recorte = quadro[y1:y2, x1:x2]
        if recorte.size == 0:
            return []
        leituras = []
        for resultado in self.alpr.predict(recorte):
            if resultado.ocr is None:
                continue
            b = resultado.detection.bounding_box
            placa = recorte[max(0, b.y1):max(0, b.y2), max(0, b.x1):max(0, b.x2)]
            leituras.append((resultado.ocr.text, resultado.ocr.confidence, placa.copy() if placa.size else None))
        return leituras
