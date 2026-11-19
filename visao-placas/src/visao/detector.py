"""Detecção de veículos com YOLOX (ONNX, pesos COCO, licença Apache-2.0), rodando em CPU."""

import cv2
import numpy as np
import onnxruntime as ort

# classes COCO que interessam: índice -> nome
CLASSES_VEICULO = {2: "carro", 3: "moto", 5: "onibus", 7: "caminhao"}


def _letterbox(imagem, tamanho):
    """Redimensiona mantendo a proporção e completa com cinza (114), como no pré-processamento oficial do YOLOX."""
    altura, largura = imagem.shape[:2]
    escala = min(tamanho / altura, tamanho / largura)
    nova = cv2.resize(imagem, (int(largura * escala), int(altura * escala)), interpolation=cv2.INTER_LINEAR)
    tela = np.full((tamanho, tamanho, 3), 114, dtype=np.uint8)
    tela[: nova.shape[0], : nova.shape[1]] = nova
    return tela, escala


def _grades(tamanho, passos=(8, 16, 32)):
    grades, escalas = [], []
    for passo in passos:
        lado = tamanho // passo
        xs, ys = np.meshgrid(np.arange(lado), np.arange(lado))
        grades.append(np.stack((xs, ys), 2).reshape(-1, 2))
        escalas.append(np.full((lado * lado, 1), passo))
    return np.concatenate(grades, 0).astype(np.float32), np.concatenate(escalas, 0).astype(np.float32)


def _nms(caixas, pontuacoes, limiar):
    x1, y1, x2, y2 = caixas.T
    areas = (x2 - x1) * (y2 - y1)
    ordem = pontuacoes.argsort()[::-1]
    manter = []
    while ordem.size:
        i = ordem[0]
        manter.append(i)
        xx1 = np.maximum(x1[i], x1[ordem[1:]])
        yy1 = np.maximum(y1[i], y1[ordem[1:]])
        xx2 = np.minimum(x2[i], x2[ordem[1:]])
        yy2 = np.minimum(y2[i], y2[ordem[1:]])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        iou = inter / (areas[i] + areas[ordem[1:]] - inter + 1e-9)
        ordem = ordem[1:][iou <= limiar]
    return manter


class DetectorVeiculos:
    def __init__(self, caminho_modelo, tamanho=416, confianca=0.35, nms=0.45, threads=2):
        opcoes = ort.SessionOptions()
        opcoes.intra_op_num_threads = threads
        opcoes.inter_op_num_threads = 1
        self.sessao = ort.InferenceSession(caminho_modelo, opcoes, providers=["CPUExecutionProvider"])
        self.entrada = self.sessao.get_inputs()[0].name
        self.tamanho = tamanho
        self.confianca = confianca
        self.nms = nms
        self.grades, self.passos = _grades(tamanho)

    def detectar(self, quadro_bgr):
        """Lista de (x1, y1, x2, y2, confiança, classe) em pixels do quadro original, só veículos."""
        imagem, escala = _letterbox(quadro_bgr, self.tamanho)
        tensor = imagem.transpose(2, 0, 1)[None].astype(np.float32)
        saida = self.sessao.run(None, {self.entrada: tensor})[0][0]
        # decodificação das saídas do YOLOX exportado sem decode (demo_postprocess)
        xy = (saida[:, :2] + self.grades) * self.passos
        wh = np.exp(saida[:, 2:4]) * self.passos
        objeto = saida[:, 4:5]
        classes = saida[:, 5:]
        indices = np.array(list(CLASSES_VEICULO), dtype=int)
        pont_classes = objeto * classes[:, indices]
        melhor = pont_classes.argmax(1)
        pontuacao = pont_classes[np.arange(len(melhor)), melhor]
        filtro = pontuacao >= self.confianca
        if not filtro.any():
            return []
        xy, wh, pontuacao, melhor = xy[filtro], wh[filtro], pontuacao[filtro], melhor[filtro]
        caixas = np.concatenate([xy - wh / 2, xy + wh / 2], 1) / escala
        # NMS sem separar classes: moto e carro na mesma caixa contam uma vez só
        manter = _nms(caixas, pontuacao, self.nms)
        altura, largura = quadro_bgr.shape[:2]
        resultado = []
        for i in manter:
            x1, y1, x2, y2 = caixas[i]
            resultado.append((
                float(max(0, x1)), float(max(0, y1)), float(min(largura, x2)), float(min(altura, y2)),
                float(pontuacao[i]), CLASSES_VEICULO[int(indices[melhor[i]])],
            ))
        return resultado
