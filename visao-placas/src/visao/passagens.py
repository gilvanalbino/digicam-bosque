"""Estado de cada veículo rastreado e fechamento das passagens pela linha virtual."""

from collections import Counter
from dataclasses import dataclass, field

from .linha import SequenciaLados
from .placa import VotacaoPlaca, confianca_media


def ancora(caixa, modo="base"):
    """Ponto que representa o veículo: meio da borda de baixo da caixa ("base") ou centro dela ("centro")."""
    x1, y1, x2, y2 = caixa
    return ((x1 + x2) / 2, (y1 + y2) / 2 if modo == "centro" else y2)


@dataclass
class Rastro:
    id: int
    primeiro: float
    ultimo: float
    lados: SequenciaLados = field(default_factory=SequenciaLados)
    classes: Counter = field(default_factory=Counter)
    votacao: VotacaoPlaca = None
    tentativas_placa: int = 0
    # melhor imagem: a do quadro com a leitura de placa mais confiável; sem placa, a da maior caixa
    foto: object = None
    foto_caixa: tuple = None
    foto_nota: float = -1.0
    recorte_placa: object = None
    recorte_nota: float = -1.0


@dataclass
class Passagem:
    instante: float
    inicio: float
    direcao: str
    classe: str
    placa: str
    confianca: float
    leituras_placa: int
    leituras_validas: int
    tentativas_placa: int
    duracao: float
    foto: object
    foto_caixa: tuple
    recorte_placa: object


class Passagens:
    """
    Recebe, a cada quadro analisado, os veículos rastreados (id, caixa, classe) e devolve as passagens prontas.
    Um rastro é fechado quando some por `tempo_perdido` segundos; se ele trocou de lado da linha, vira passagem.
    """

    def __init__(self, linha, tempo_perdido=3.0, max_tentativas_placa=15, confianca_placa=0.5,
                 area_minima_placa=0.0, modo_ancora="base"):
        self.linha = linha
        self.modo_ancora = modo_ancora
        self.tempo_perdido = tempo_perdido
        self.max_tentativas_placa = max_tentativas_placa
        self.confianca_placa = confianca_placa
        self.area_minima_placa = area_minima_placa
        self.rastros = {}

    def atualizar(self, instante, veiculos, quadro=None):
        """veiculos: lista de (id, caixa, classe). Guarda a imagem como foto candidata. Retorna passagens fechadas."""
        for id_, caixa, classe in veiculos:
            rastro = self.rastros.get(id_)
            if rastro is None:
                rastro = Rastro(id=id_, primeiro=instante, ultimo=instante,
                                votacao=VotacaoPlaca(self.confianca_placa))
                self.rastros[id_] = rastro
            rastro.ultimo = instante
            rastro.classes[classe] += 1
            lado = self.linha.lado(ancora(caixa, self.modo_ancora))
            rastro.lados.registrar(lado, instante)
            if quadro is not None and rastro.foto_nota < 0:
                area = (caixa[2] - caixa[0]) * (caixa[3] - caixa[1])
                # enquanto não há placa lida, a nota é negativa e cresce com o tamanho do veículo; quadros do lado
                # de fora (veículo chegando, de frente para a câmera) valem mais que os da passagem pela cancela
                nota_area = -1.0 / (1.0 + area) if lado == "fora" else -2.0 - 1.0 / (1.0 + area)
                if rastro.foto is None or nota_area > rastro.foto_nota:
                    rastro.foto, rastro.foto_caixa, rastro.foto_nota = quadro, tuple(caixa), nota_area
        return self._fechar(instante)

    def deve_ler_placa(self, id_, caixa):
        rastro = self.rastros.get(id_)
        if rastro is None or rastro.tentativas_placa >= self.max_tentativas_placa:
            return False
        area = (caixa[2] - caixa[0]) * (caixa[3] - caixa[1])
        return area >= self.area_minima_placa

    def registrar_placa(self, id_, leituras, quadro=None, caixa=None):
        """leituras: lista de (texto, confiança, recorte da placa) feitas no recorte do veículo neste quadro."""
        rastro = self.rastros.get(id_)
        if rastro is None:
            return
        rastro.tentativas_placa += 1
        for texto, confianca, recorte in leituras:
            if not rastro.votacao.adicionar(texto, confianca):
                continue
            nota = confianca_media(confianca)
            if quadro is not None and nota > rastro.foto_nota:
                rastro.foto, rastro.foto_caixa, rastro.foto_nota = quadro, tuple(caixa), nota
            if recorte is not None and nota > rastro.recorte_nota:
                rastro.recorte_placa, rastro.recorte_nota = recorte, nota

    def fechar_todos(self, instante):
        return self._fechar(instante, tudo=True)

    def _fechar(self, instante, tudo=False):
        prontas = []
        for id_ in list(self.rastros):
            rastro = self.rastros[id_]
            if not tudo and instante - rastro.ultimo < self.tempo_perdido:
                continue
            del self.rastros[id_]
            direcao = rastro.lados.direcao()
            if direcao is None:
                continue
            placa, confianca, leituras, validas = rastro.votacao.resultado()
            classe = rastro.classes.most_common(1)[0][0] if rastro.classes else "veiculo"
            prontas.append(Passagem(
                instante=rastro.lados.instante_troca or rastro.ultimo,
                inicio=rastro.primeiro,
                direcao=direcao,
                classe=classe,
                placa=placa,
                confianca=round(confianca, 3),
                leituras_placa=leituras,
                leituras_validas=validas,
                tentativas_placa=rastro.tentativas_placa,
                duracao=round(rastro.ultimo - rastro.primeiro, 2),
                foto=rastro.foto,
                foto_caixa=rastro.foto_caixa,
                recorte_placa=rastro.recorte_placa,
            ))
        return prontas
