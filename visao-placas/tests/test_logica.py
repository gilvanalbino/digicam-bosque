import os
import time

import numpy as np
import pytest

from visao.armazenamento import Armazenamento
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


# ---------------- eventos para o sistema

def test_leitura_estavel_e_avisada_uma_vez_e_de_novo_se_a_placa_mudar():
    p = Passagens(linha_horizontal(), leituras_estavel=3)
    p.atualizar(1.0, [(1, caixa_em(900), "carro")])
    for _ in range(2):
        p.registrar_placa(1, [("ABC1D23", 0.9, None)])
    assert p.leituras_estaveis() == []                 # só 2 leituras
    p.registrar_placa(1, [("ABC1D23", 0.9, None)])
    [leitura] = p.leituras_estaveis()
    assert leitura.placa == "ABC1D23" and leitura.rastro == 1 and leitura.inicio == 1.0
    assert p.leituras_estaveis() == []                 # já avisada
    for _ in range(4):
        p.registrar_placa(1, [("ABC1D28", 0.95, None)])
    assert [l.placa for l in p.leituras_estaveis()] == ["ABC1D28"]


def test_placa_avisada_sem_cruzar_a_linha_vira_passagem_nenhuma():
    p = Passagens(linha_horizontal(), tempo_perdido=1.0, leituras_estavel=1)
    p.atualizar(1.0, [(5, caixa_em(900), "carro")])
    p.registrar_placa(5, [("ABC1D23", 0.9, None)])
    assert len(p.leituras_estaveis()) == 1
    [passagem] = p.atualizar(5.0, [])
    assert passagem.direcao == "nenhuma" and passagem.placa_enviada == "ABC1D23" and passagem.rastro == 5


def test_url_rtsp_e_assinatura():
    from visao.servico import assinatura, url_rtsp
    camera = {"id": 5, "url": "10.0.0.187", "login": "admin", "senha": "teste@123", "sentido": "E",
              "config_software": {"canal": 101}}
    assert url_rtsp(camera, 101) == "rtsp://admin:teste%40123@10.0.0.187:554/Streaming/Channels/101"
    assert url_rtsp({**camera, "url": "10.0.0.187:80"}, 102).endswith("@10.0.0.187:554/Streaming/Channels/102")
    assert assinatura(camera) != assinatura({**camera, "config_software": {"canal": 102}})


def test_iso():
    from visao.sistema import iso
    assert iso(1794852124.5) == "2026-11-16T18:02:04.500Z"


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
