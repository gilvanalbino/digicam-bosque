"""Compara as passagens vistas pelo software com as entradas que a câmera registrou (Trafegos do HML)."""

import logging
import time
from datetime import timezone

from .placa import diferencas_placas

log = logging.getLogger("visao.comparacao")

AMBOS_IGUAL = "ambos_igual"                  # os dois viram, mesma placa
AMBOS_DIFERENTE = "ambos_diferente"          # os dois viram, placas diferentes
AMBOS_SEM_PLACA = "ambos_sem_placa"          # os dois viram, o software não leu a placa
SO_SOFTWARE_PLACA = "so_software_placa"      # só o software viu, com placa (ganho)
SO_SOFTWARE_SEM_PLACA = "so_software_sem_placa"  # só o software viu, sem placa (ganho parcial)
SAIDA = "saida"                              # passagem no sentido contrário (não é comparada)

DESCRICOES = {
    AMBOS_IGUAL: "Câmera e software, mesma placa",
    AMBOS_DIFERENTE: "Câmera e software, placas diferentes",
    AMBOS_SEM_PLACA: "Câmera e software, software sem placa",
    "so_camera": "Só a câmera (software perdeu)",
    SO_SOFTWARE_PLACA: "Só o software, com placa",
    SO_SOFTWARE_SEM_PLACA: "Só o software, sem placa",
    SAIDA: "Software viu no sentido de saída",
}


def casar(software, camera, tolerancia=20.0):
    """
    software: lista de dicts {id, inicio, instante, placa}; camera: lista de dicts {id, instante, placa}.
    A câmera lê a placa quando o veículo chega e o software registra quando ele cruza a linha, depois de a
    cancela abrir; por isso a leitura da câmera vale de `inicio - tolerância` até `instante + tolerância`.
    Casa cada entrada da câmera com no máximo uma passagem do software, dando preferência à placa mais parecida e
    depois ao horário mais próximo da chegada. Retorna (pares, sobras_software,
    sobras_camera), em que pares é uma lista de (software, camera).
    """
    candidatos = []
    for c in camera:
        for s in software:
            inicio = s.get("inicio") or s["instante"]
            if inicio - tolerancia <= c["instante"] <= s["instante"] + tolerancia:
                dt = abs(inicio - c["instante"])
                dif = diferencas_placas(s["placa"], c["placa"]) if s.get("placa") else 99
                candidatos.append((dif, dt, s["id"], c["id"], s, c))
    candidatos.sort(key=lambda x: (x[0], x[1]))
    usados_s, usados_c, pares = set(), set(), []
    for _, _, sid, cid, s, c in candidatos:
        if sid in usados_s or cid in usados_c:
            continue
        usados_s.add(sid)
        usados_c.add(cid)
        pares.append((s, c))
    sobras_s = [s for s in software if s["id"] not in usados_s]
    sobras_c = [c for c in camera if c["id"] not in usados_c]
    return pares, sobras_s, sobras_c


def categoria_par(s, c):
    if not s.get("placa"):
        return AMBOS_SEM_PLACA
    return AMBOS_IGUAL if s["placa"] == c["placa"] else AMBOS_DIFERENTE


class Comparacao:
    """
    Recalcula periodicamente a janela recente (`janela` segundos), deixando de fora os últimos `atraso` segundos,
    em que a câmera ainda pode estar registrando. O banco do HML é só lido.
    """

    def __init__(self, armazenamento, conectar_mysql, camera_id, portaria_id, tolerancia=20.0,
                 janela=3 * 3600, atraso=90, desde=None):
        self.armazenamento = armazenamento
        self.conectar_mysql = conectar_mysql
        self.camera_id = camera_id
        self.portaria_id = portaria_id
        self.tolerancia = tolerancia
        self.janela = janela
        self.atraso = atraso
        # antes de o serviço começar a assistir ao vídeo não há o que comparar
        self.desde = desde

    def _entradas_camera(self, inicio, fim):
        conexao = self.conectar_mysql()
        try:
            with conexao.cursor() as cur:
                cur.execute(
                    "SELECT id, placa, dataEntrada FROM Trafegos WHERE portaria_entrada_id=%s "
                    "AND dataEntrada BETWEEN FROM_UNIXTIME(%s) AND FROM_UNIXTIME(%s)",
                    (self.portaria_id, inicio, fim),
                )
                linhas = cur.fetchall()
        finally:
            conexao.close()
        # dataEntrada é gravada em UTC (Sequelize); a conexão usa time_zone UTC
        return [{"id": l[0], "placa": l[1], "instante": l[2].replace(tzinfo=timezone.utc).timestamp()}
                for l in linhas]

    def executar(self, agora=None):
        agora = agora or time.time()
        fim = agora - self.atraso
        inicio = fim - self.janela
        if self.desde:
            inicio = max(inicio, self.desde)
        if inicio >= fim:
            return 0, 0, 0
        # a margem da tolerância nas bordas evita perder pares que cruzam o limite da janela
        camera = self._entradas_camera(inicio - self.tolerancia, fim + self.tolerancia)
        software = self.armazenamento.consultar(
            "SELECT id, inicio, instante, placa, direcao FROM passagens WHERE camera_id=? AND instante BETWEEN ? AND ?",
            (self.camera_id, inicio - self.tolerancia, fim + self.tolerancia),
        )
        entradas = [s for s in software if s["direcao"] == "entrada"]
        pares, sobras_s, sobras_c = casar(entradas, camera, self.tolerancia)

        # só grava o resultado das passagens de dentro da janela; as da margem são resolvidas em outra rodada
        na_janela = lambda s: inicio <= s["instante"] <= fim  # noqa: E731
        atualizacoes = []
        for s, c in pares:
            if na_janela(s):
                atualizacoes.append((categoria_par(s, c), c["placa"], c["instante"], c["id"], s["id"]))
        for s in sobras_s:
            if na_janela(s):
                cat = SO_SOFTWARE_PLACA if s.get("placa") else SO_SOFTWARE_SEM_PLACA
                atualizacoes.append((cat, None, None, None, s["id"]))
        for s in software:
            if s["direcao"] != "entrada" and na_janela(s):
                atualizacoes.append((SAIDA, None, None, None, s["id"]))
        self.armazenamento.executar(
            "UPDATE passagens SET comparacao=?, camera_placa=?, camera_instante=?, trafego_id=? WHERE id=?",
            atualizacoes, muitos=True,
        )
        # entradas da câmera sem passagem do software, só as de dentro da janela
        self.armazenamento.executar(
            "DELETE FROM so_camera WHERE camera_id=? AND instante BETWEEN ? AND ?", (self.camera_id, inicio, fim)
        )
        self.armazenamento.executar(
            "INSERT OR REPLACE INTO so_camera (trafego_id, camera_id, instante, placa) VALUES (?,?,?,?)",
            [(c["id"], self.camera_id, c["instante"], c["placa"]) for c in sobras_c if inicio <= c["instante"] <= fim],
            muitos=True,
        )
        log.info("comparação: %d pares, %d só software, %d só câmera", len(pares), len(sobras_s), len(sobras_c))
        return len(pares), len(sobras_s), len(sobras_c)
