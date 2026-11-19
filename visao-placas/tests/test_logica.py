import os
import time
from datetime import datetime, timezone

import numpy as np
import pytest

from visao.armazenamento import Armazenamento
from visao.comparacao import (AMBOS_DIFERENTE, AMBOS_IGUAL, AMBOS_SEM_PLACA, SAIDA, SO_SOFTWARE_PLACA,
                              SO_SOFTWARE_SEM_PLACA, Comparacao, casar)
from visao.linha import Linha, SequenciaLados
from visao.passagens import Passagem, Passagens
from visao.placa import VotacaoPlaca, diferencas_placas, normalizar, placa_valida


# ---------------- placa (mesmos casos de backend/services/placaUtil.js)

@pytest.mark.parametrize("a,b,esperado", [
    ("ABC1D23", "ABC1D23", 0),
    ("ABC1D23", "ABC1D28", 1),
    ("ABC1D23", "ABC1D2", 1),     # caractere faltando
    ("ABC1D23", "XABC1D23", 1),   # caractere sobrando
    ("ABC1D23", "ABD1C23", 2),
    ("", "ABC", 3),
])
def test_diferencas_placas(a, b, esperado):
    assert diferencas_placas(a, b) == esperado


def test_formato_e_normalizacao():
    assert normalizar("abc-1d23_") == "ABC1D23"
    assert placa_valida("ABC1D23") and placa_valida("ABC1234")
    assert not placa_valida("ACESOGLBA") and not placa_valida("AB12345") and not placa_valida("ABC1D2")


def test_votacao_escolhe_a_placa_mais_lida_e_ignora_invalidas():
    v = VotacaoPlaca(confianca_minima=0.5)
    assert v.adicionar("ABC1D23", 0.9)
    assert v.adicionar("ABC1D23", [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8])
    assert v.adicionar("ABC1D28", 0.95)
    assert not v.adicionar("ACESOGLBA", 0.99)   # formato inválido
    assert not v.adicionar("XYZ9A99", 0.3)      # confiança baixa
    placa, conf, n, total = v.resultado()
    assert (placa, n, total) == ("ABC1D23", 2, 3)
    assert conf == pytest.approx(0.85)


def test_votacao_vazia():
    assert VotacaoPlaca().resultado() == (None, 0.0, 0, 0)


# ---------------- linha

def linha_horizontal():
    # linha y=500; dentro do condomínio é para cima (y menor)
    return Linha((0, 500), (1920, 500), ponto_dentro=(960, 100), margem=15)


def test_lado_e_margem():
    l = linha_horizontal()
    assert l.lado((100, 300)) == "dentro"
    assert l.lado((100, 700)) == "fora"
    assert l.lado((100, 510)) is None


def test_ponto_dentro_em_cima_da_linha():
    with pytest.raises(ValueError):
        Linha((0, 500), (100, 500), ponto_dentro=(50, 505))


def test_sequencia_lados():
    s = SequenciaLados()
    for lado, t in [("fora", 1), (None, 2), ("dentro", 3), ("dentro", 4)]:
        s.registrar(lado, t)
    assert s.direcao() == "entrada" and s.instante_troca == 3
    manobra = SequenciaLados()
    for lado, t in [("fora", 1), ("dentro", 2), ("fora", 3)]:
        manobra.registrar(lado, t)
    assert manobra.direcao() is None


# ---------------- passagens

def caixa_em(y_base, altura=200):
    return (800, y_base - altura, 1100, y_base)


def test_passagem_de_entrada_com_placa():
    p = Passagens(linha_horizontal(), tempo_perdido=3.0)
    quadro = np.zeros((1080, 1920, 3), dtype=np.uint8)
    for i, y in enumerate([900, 800, 700, 600, 450, 350]):
        p.atualizar(10 + i * 0.2, [(1, caixa_em(y), "moto")], quadro)
        if p.deve_ler_placa(1, caixa_em(y)):
            p.registrar_placa(1, [("ABC1D23", 0.9, np.zeros((20, 60, 3), np.uint8))], quadro, caixa_em(y))
    assert p.atualizar(12.0, [], quadro) == []          # ainda dentro do tempo_perdido
    prontas = p.atualizar(20.0, [], quadro)
    assert len(prontas) == 1
    passagem = prontas[0]
    assert passagem.direcao == "entrada" and passagem.classe == "moto" and passagem.placa == "ABC1D23"
    assert passagem.instante == pytest.approx(10.8)     # quando a âncora passou para o lado de dentro
    assert passagem.inicio == pytest.approx(10.0)
    assert passagem.recorte_placa is not None and passagem.foto is not None


def test_sem_placa_a_foto_e_a_do_veiculo_chegando():
    p = Passagens(linha_horizontal(), tempo_perdido=1.0)
    chegando = np.full((10, 10, 3), 1, np.uint8)
    na_cancela = np.full((10, 10, 3), 2, np.uint8)
    # do lado de fora a caixa é menor; do lado de dentro, maior (veículo perto da câmera, de lado)
    p.atualizar(1.0, [(1, (800, 760, 1000, 900), "carro")], chegando)
    p.atualizar(1.2, [(1, (500, 100, 1500, 400), "carro")], na_cancela)
    passagem = p.atualizar(5.0, [])[0]
    assert passagem.placa is None and passagem.foto is chegando


def test_veiculo_que_nao_cruza_nao_vira_passagem():
    p = Passagens(linha_horizontal(), tempo_perdido=1.0)
    p.atualizar(1.0, [(7, caixa_em(900), "carro")])
    p.atualizar(1.2, [(7, caixa_em(850), "carro")])
    assert p.atualizar(5.0, []) == []


def test_limite_de_tentativas_de_placa():
    p = Passagens(linha_horizontal(), max_tentativas_placa=2)
    p.atualizar(1.0, [(1, caixa_em(900), "carro")])
    for _ in range(2):
        assert p.deve_ler_placa(1, caixa_em(900))
        p.registrar_placa(1, [])
    assert not p.deve_ler_placa(1, caixa_em(900))


# ---------------- comparação

def test_casar_prefere_placa_igual_e_respeita_tolerancia():
    software = [{"id": 1, "instante": 100.0, "placa": "ABC1D23"},
                {"id": 2, "instante": 101.0, "placa": None},
                {"id": 3, "instante": 500.0, "placa": "QWE1R23"}]
    camera = [{"id": 10, "instante": 102.0, "placa": "ABC1D23"},
              {"id": 11, "instante": 103.0, "placa": "ZZZ9Z99"},
              {"id": 12, "instante": 900.0, "placa": "LMN4O56"}]
    pares, sobras_s, sobras_c = casar(software, camera, tolerancia=20)
    assert {(s["id"], c["id"]) for s, c in pares} == {(1, 10), (2, 11)}
    assert [s["id"] for s in sobras_s] == [3]
    assert [c["id"] for c in sobras_c] == [12]


def test_casar_aceita_leitura_da_camera_na_chegada():
    # o veículo chegou às 100, esperou a cancela e cruzou a linha às 160; a câmera leu às 101
    software = [{"id": 1, "inicio": 100.0, "instante": 160.0, "placa": "ABC1D23"}]
    camera = [{"id": 10, "instante": 101.0, "placa": "ABC1D23"}, {"id": 11, "instante": 200.0, "placa": "XYZ1D23"}]
    pares, _, sobras_c = casar(software, camera, tolerancia=20)
    assert [(s["id"], c["id"]) for s, c in pares] == [(1, 10)]
    assert [c["id"] for c in sobras_c] == [11]


class BancoFalso:
    def __init__(self, linhas):
        self.linhas = linhas

    def __call__(self):
        banco = self

        class Cursor:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def execute(self, sql, parametros):
                self.parametros = parametros

            def fetchall(self):
                # dataEntrada vem do MySQL sem fuso, em UTC
                _, inicio, fim = self.parametros
                return [l for l in banco.linhas
                        if inicio <= l[2].replace(tzinfo=timezone.utc).timestamp() <= fim]

        class Conexao:
            def cursor(self):
                return Cursor()

            def close(self):
                pass

        return Conexao()


def test_comparacao_classifica_e_grava(tmp_path):
    arm = Armazenamento(str(tmp_path))
    agora = 1_000_000.0
    base = agora - 3600

    def gravar(instante, direcao, placa):
        return arm.gravar(5, Passagem(instante, instante, direcao, "carro", placa, 0.9, 1, 1, 1, 1.0, None, None, None))

    igual = gravar(base, "entrada", "ABC1D23")
    diferente = gravar(base + 100, "entrada", "ABC1D28")
    sem_placa = gravar(base + 200, "entrada", None)
    so_soft = gravar(base + 300, "entrada", "QWE1R23")
    so_soft_sem = gravar(base + 400, "entrada", None)
    saida = gravar(base + 500, "saida", None)

    def utc(t):
        return datetime.fromtimestamp(t, tz=timezone.utc).replace(tzinfo=None)

    camera = [(1, "ABC1D23", utc(base + 2)), (2, "XYZ1D23", utc(base + 105)), (3, "KKK1K11", utc(base + 195)),
              (4, "PPP2P22", utc(base + 1000))]

    Comparacao(arm, BancoFalso(camera), camera_id=5, portaria_id=3, janela=7200, atraso=90).executar(agora)
    resultado = {l["id"]: l["comparacao"] for l in arm.consultar("SELECT id, comparacao FROM passagens")}
    assert resultado == {igual: AMBOS_IGUAL, diferente: AMBOS_DIFERENTE, sem_placa: AMBOS_SEM_PLACA,
                         so_soft: SO_SOFTWARE_PLACA, so_soft_sem: SO_SOFTWARE_SEM_PLACA, saida: SAIDA}
    assert [l["trafego_id"] for l in arm.consultar("SELECT trafego_id FROM so_camera")] == [4]


def test_comparacao_ignora_periodo_antes_do_servico(tmp_path):
    arm = Armazenamento(str(tmp_path))
    agora = 1_000_000.0
    camera = [(1, "ABC1D23", datetime.fromtimestamp(agora - 3000, tz=timezone.utc).replace(tzinfo=None))]
    comparacao = Comparacao(arm, BancoFalso(camera), camera_id=5, portaria_id=3, desde=agora - 1000)
    assert comparacao.executar(agora) == (0, 0, 0)
    assert arm.consultar("SELECT * FROM so_camera") == []


# ---------------- armazenamento e retenção

def test_retencao_por_espaco_e_idade(tmp_path):
    arm = Armazenamento(str(tmp_path), limite_bytes=2500, dias=15)
    pasta = os.path.join(arm.pasta_fotos, "2026", "11", "16")
    os.makedirs(pasta)
    agora = time.time()
    for i, idade_dias in enumerate([20, 3, 2, 1]):
        caminho = os.path.join(pasta, f"f{i}.jpg")
        with open(caminho, "wb") as f:
            f.write(b"x" * 1000)
        t = agora - idade_dias * 86400
        os.utime(caminho, (t, t))
    apagados = arm.limpar(agora)
    # a de 20 dias sai pela idade; das 3 restantes (3000 bytes) sai a mais antiga para ficar em 2500
    assert apagados == 2
    assert sorted(os.listdir(pasta)) == ["f2.jpg", "f3.jpg"]


def test_caminho_foto_nao_sai_da_pasta(tmp_path):
    arm = Armazenamento(str(tmp_path))
    assert arm.caminho_foto("../eventos.db") is None
    assert arm.caminho_foto("nao/existe.jpg") is None
