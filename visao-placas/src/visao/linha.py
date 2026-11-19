"""Linha virtual: de que lado dela está um ponto e se uma passagem foi de entrada ou de saída."""


class Linha:
    """
    Segmento p1-p2 na imagem e um ponto qualquer do lado de dentro do condomínio. Um veículo que começa de um
    lado e termina do outro passou pela linha; se terminou do lado de dentro, foi uma entrada.
    A margem (em pixels) evita que o veículo parado em cima da linha fique trocando de lado.
    """

    def __init__(self, p1, p2, ponto_dentro, margem=15):
        self.p1 = tuple(map(float, p1))
        self.p2 = tuple(map(float, p2))
        self.margem = float(margem)
        comprimento = ((self.p2[0] - self.p1[0]) ** 2 + (self.p2[1] - self.p1[1]) ** 2) ** 0.5
        if comprimento == 0:
            raise ValueError("linha com os dois pontos iguais")
        self._comprimento = comprimento
        lado = self._distancia(ponto_dentro)
        if abs(lado) <= self.margem:
            raise ValueError("ponto_dentro está em cima da linha")
        self.sinal_dentro = 1 if lado > 0 else -1

    def _distancia(self, ponto):
        (x1, y1), (x2, y2) = self.p1, self.p2
        x, y = ponto
        return ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) / self._comprimento

    def lado(self, ponto):
        """'dentro', 'fora' ou None quando o ponto está na faixa da margem."""
        d = self._distancia(ponto)
        if abs(d) <= self.margem:
            return None
        return "dentro" if (1 if d > 0 else -1) == self.sinal_dentro else "fora"


class SequenciaLados:
    """
    Acompanha os lados por onde um veículo passou. A passagem vale pelo primeiro e pelo último lado conhecidos:
    quem entrou e voltou (manobra) não conta. O instante da passagem é o da última troca de lado.
    """

    def __init__(self):
        self.inicial = None
        self.atual = None
        self.instante_troca = None

    def registrar(self, lado, instante):
        if lado is None:
            return
        if self.inicial is None:
            self.inicial = lado
        elif lado != self.atual:
            self.instante_troca = instante
        self.atual = lado

    def direcao(self):
        """'entrada', 'saida' ou None (não cruzou, ou voltou para o lado de onde veio)."""
        if self.inicial is None or self.atual is None or self.inicial == self.atual:
            return None
        return "entrada" if self.atual == "dentro" else "saida"
