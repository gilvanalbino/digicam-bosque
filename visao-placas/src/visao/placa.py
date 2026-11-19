"""Normalização, validação e votação das leituras de placa feitas nos quadros de uma mesma passagem."""

import re
from collections import defaultdict

# mesmo limite do backend (TAMANHO_MAXIMO_PLACA): placa brasileira tem 7 caracteres
TAMANHO_PLACA = 7

# antiga (AAA9999) e Mercosul (AAA9A99)
FORMATO_PLACA = re.compile(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")


def normalizar(texto):
    """Maiúsculas, só letras e números (o OCR devolve '_' como preenchimento)."""
    return re.sub(r"[^A-Z0-9]", "", (texto or "").upper())


def placa_valida(placa):
    return bool(FORMATO_PLACA.match(placa or ""))


def diferencas_placas(a="", b=""):
    """Distância de edição entre duas placas. Mesma regra de backend/services/placaUtil.js (diferencasPlacas)."""
    a, b = a or "", b or ""
    anterior = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        atual = [i]
        for j in range(1, len(b) + 1):
            troca = anterior[j - 1] + (0 if a[i - 1] == b[j - 1] else 1)
            atual.append(min(troca, anterior[j] + 1, atual[j - 1] + 1))
        anterior = atual
    return anterior[len(b)]


def confianca_media(confianca):
    if isinstance(confianca, (list, tuple)):
        return sum(confianca) / len(confianca) if confianca else 0.0
    try:
        return float(confianca)
    except (TypeError, ValueError):
        return 0.0


class VotacaoPlaca:
    """
    Junta as leituras de uma passagem. Só entram placas no formato brasileiro. A placa escolhida é a de maior
    soma de confianças; no empate, a de maior confiança isolada. A confiança informada é a média das leituras dela.
    """

    def __init__(self, confianca_minima=0.5):
        self.confianca_minima = confianca_minima
        self.soma = defaultdict(float)
        self.maxima = defaultdict(float)
        self.quantidade = defaultdict(int)
        self.leituras = 0

    def adicionar(self, texto, confianca):
        placa = normalizar(texto)
        conf = confianca_media(confianca)
        if not placa_valida(placa) or conf < self.confianca_minima:
            return False
        self.leituras += 1
        self.soma[placa] += conf
        self.maxima[placa] = max(self.maxima[placa], conf)
        self.quantidade[placa] += 1
        return True

    def resultado(self):
        """(placa, confiança média, leituras dessa placa, total de leituras válidas) ou (None, 0, 0, 0)."""
        if not self.soma:
            return None, 0.0, 0, 0
        placa = max(self.soma, key=lambda p: (self.soma[p], self.maxima[p]))
        return placa, self.soma[placa] / self.quantidade[placa], self.quantidade[placa], self.leituras
