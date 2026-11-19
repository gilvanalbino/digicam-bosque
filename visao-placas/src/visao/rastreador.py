"""
Rastreador simples por sobreposição de caixas (IoU). Na cancela passam poucos veículos ao mesmo tempo e devagar,
então casar cada detecção com a caixa mais sobreposta do quadro anterior basta.
"""


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    if inter == 0:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return inter / (area_a + area_b - inter)


class Rastreador:
    def __init__(self, iou_minimo=0.25, quadros_perdido=15):
        self.iou_minimo = iou_minimo
        self.quadros_perdido = quadros_perdido
        self.ativos = {}  # id -> {"caixa", "perdido"}
        self.proximo_id = 1

    def atualizar(self, deteccoes):
        """deteccoes: lista de (x1, y1, x2, y2, confiança, classe). Retorna lista de (id, caixa, classe)."""
        pares = []
        for i, d in enumerate(deteccoes):
            for id_, r in self.ativos.items():
                s = iou(d[:4], r["caixa"])
                if s >= self.iou_minimo:
                    pares.append((s, i, id_))
        pares.sort(reverse=True)
        usados_d, usados_r, resultado = set(), set(), []
        for _, i, id_ in pares:
            if i in usados_d or id_ in usados_r:
                continue
            usados_d.add(i)
            usados_r.add(id_)
            self.ativos[id_] = {"caixa": tuple(deteccoes[i][:4]), "perdido": 0}
            resultado.append((id_, tuple(deteccoes[i][:4]), deteccoes[i][5]))
        for i, d in enumerate(deteccoes):
            if i in usados_d:
                continue
            id_ = self.proximo_id
            self.proximo_id += 1
            self.ativos[id_] = {"caixa": tuple(d[:4]), "perdido": 0}
            resultado.append((id_, tuple(d[:4]), d[5]))
        for id_ in list(self.ativos):
            if id_ not in usados_r and not any(r[0] == id_ for r in resultado):
                self.ativos[id_]["perdido"] += 1
                if self.ativos[id_]["perdido"] > self.quadros_perdido:
                    del self.ativos[id_]
        return resultado
