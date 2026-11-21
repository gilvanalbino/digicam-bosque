"""
Integração com o backend do Digicam: login, câmeras com a identificação por software ligada e envio dos eventos
(docs/plano_identificacao_placas_software.md, seção 6). Os eventos passam por uma fila em SQLite: se o backend estiver
fora do ar, são reenviados depois, e o `rastro` torna o reenvio idempotente.
"""

import base64
import json
import logging
import sqlite3
import threading
import time
import urllib.error
import urllib.request

import cv2

log = logging.getLogger("visao.sistema")

LARGURA_FOTO = 960


class ErroBackend(Exception):
    pass


class Backend:
    def __init__(self, url, email, senha, tempo_limite=30):
        self.url = url.rstrip("/")
        self.email = email
        self.senha = senha
        self.tempo_limite = tempo_limite
        self.token = None
        self._trava = threading.Lock()

    def _requisicao(self, metodo, caminho, dados=None, autenticar=True):
        corpo = json.dumps(dados).encode() if dados is not None else None
        req = urllib.request.Request(f"{self.url}{caminho}", data=corpo, method=metodo)
        req.add_header("Content-Type", "application/json")
        if autenticar:
            req.add_header("Authorization", self._obter_token())
        try:
            with urllib.request.urlopen(req, timeout=self.tempo_limite) as resp:
                texto = resp.read().decode() or "null"
                return json.loads(texto)
        except urllib.error.HTTPError as erro:
            if erro.code == 401 and autenticar:
                self.token = None
            raise ErroBackend(f"{metodo} {caminho}: HTTP {erro.code} {erro.read()[:200]!r}") from erro
        except (urllib.error.URLError, TimeoutError, ConnectionError) as erro:
            raise ErroBackend(f"{metodo} {caminho}: {erro}") from erro

    def _obter_token(self):
        with self._trava:
            if not self.token:
                r = self._requisicao("POST", "/digicam/login", {"email": self.email, "password": self.senha},
                                     autenticar=False)
                self.token = r["token"]
            return self.token

    def cameras(self):
        """Câmeras com a identificação por software ligada (id, url, login, senha, sentido, config_software)."""
        return self._requisicao("GET", "/digicam/cameras/software")

    def enviar(self, tipo, evento):
        return self._requisicao("POST", f"/digicam/identificacoesSoftware/{tipo}", evento)


def imagem_base64(imagem, largura=None, caixa=None):
    """JPEG em data URL, como as fotos da câmera chegam ao backend."""
    if imagem is None:
        return None
    if caixa is not None:
        imagem = imagem.copy()
        x1, y1, x2, y2 = (int(v) for v in caixa)
        cv2.rectangle(imagem, (x1, y1), (x2, y2), (0, 200, 255), 4)
    if largura and imagem.shape[1] > largura:
        escala = largura / imagem.shape[1]
        imagem = cv2.resize(imagem, (largura, int(imagem.shape[0] * escala)), interpolation=cv2.INTER_AREA)
    ok, jpeg = cv2.imencode(".jpg", imagem, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return "data:image/jpeg;base64," + base64.b64encode(jpeg.tobytes()).decode() if ok else None


def iso(instante):
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(instante)) + f".{int((instante % 1) * 1000):03d}Z"


class FilaEventos:
    """Fila persistente de eventos; uma thread envia em ordem e repete com espera crescente quando falha."""

    def __init__(self, caminho, backend, maximo=5000):
        self.backend = backend
        self.maximo = maximo
        self.db = sqlite3.connect(caminho, check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, dados TEXT)")
        self.db.commit()
        self._trava = threading.Lock()
        self._sinal = threading.Event()
        self.enviados = 0
        self.falhas = 0
        self.ultimo_erro = None

    def colocar(self, tipo, evento):
        with self._trava:
            self.db.execute("INSERT INTO eventos (tipo, dados) VALUES (?, ?)", (tipo, json.dumps(evento)))
            # backend fora do ar por muito tempo: descarta os mais antigos para não crescer sem limite
            self.db.execute("DELETE FROM eventos WHERE id <= (SELECT MAX(id) - ? FROM eventos)", (self.maximo,))
            self.db.commit()
        self._sinal.set()

    def pendentes(self):
        with self._trava:
            return self.db.execute("SELECT COUNT(*) FROM eventos").fetchone()[0]

    def _proximo(self):
        with self._trava:
            return self.db.execute("SELECT id, tipo, dados FROM eventos ORDER BY id LIMIT 1").fetchone()

    def _remover(self, id_):
        with self._trava:
            self.db.execute("DELETE FROM eventos WHERE id = ?", (id_,))
            self.db.commit()

    def rodar(self, parar):
        espera = 1.0
        while not parar():
            item = self._proximo()
            if item is None:
                self._sinal.wait(1.0)
                self._sinal.clear()
                continue
            id_, tipo, dados = item
            try:
                self.backend.enviar(tipo, json.loads(dados))
                self._remover(id_)
                self.enviados += 1
                espera = 1.0
            except ErroBackend as erro:
                self.falhas += 1
                self.ultimo_erro = str(erro)
                # 4xx que não seja de login: o evento é inválido e não adianta repetir
                if " HTTP 4" in str(erro) and " HTTP 401" not in str(erro):
                    log.error("evento descartado: %s", erro)
                    self._remover(id_)
                    continue
                log.warning("envio falhou (%s); nova tentativa em %.0f s", erro, espera)
                time.sleep(espera)
                espera = min(espera * 2, 60)
