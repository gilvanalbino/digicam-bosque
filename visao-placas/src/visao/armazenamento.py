"""Passagens em SQLite e fotos em disco, com limite de espaço e de idade."""

import os
import sqlite3
import threading
import time
from datetime import datetime

import cv2

ESQUEMA = """
CREATE TABLE IF NOT EXISTS passagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  camera_id INTEGER NOT NULL,
  instante REAL NOT NULL,
  -- primeira vez que o veículo apareceu (a câmera lê a placa na chegada, antes de a cancela abrir)
  inicio REAL,
  direcao TEXT NOT NULL,
  classe TEXT NOT NULL,
  placa TEXT,
  confianca REAL,
  leituras_placa INTEGER,
  leituras_validas INTEGER,
  tentativas_placa INTEGER,
  duracao REAL,
  foto TEXT,
  foto_placa TEXT,
  -- comparação com a câmera (preenchida pela rotina de comparação)
  comparacao TEXT,
  camera_placa TEXT,
  camera_instante REAL,
  trafego_id INTEGER
);
CREATE INDEX IF NOT EXISTS passagens_instante ON passagens (camera_id, instante);
CREATE TABLE IF NOT EXISTS so_camera (
  trafego_id INTEGER PRIMARY KEY,
  camera_id INTEGER NOT NULL,
  instante REAL NOT NULL,
  placa TEXT
);
CREATE INDEX IF NOT EXISTS so_camera_instante ON so_camera (camera_id, instante);
CREATE TABLE IF NOT EXISTS estado (chave TEXT PRIMARY KEY, valor TEXT);
"""

LARGURA_FOTO = 960


class Armazenamento:
    def __init__(self, pasta, limite_bytes=2 * 1024**3, dias=15):
        self.pasta = pasta
        self.pasta_fotos = os.path.join(pasta, "fotos")
        self.limite_bytes = limite_bytes
        self.dias = dias
        os.makedirs(self.pasta_fotos, exist_ok=True)
        self._trava = threading.Lock()
        self.db = sqlite3.connect(os.path.join(pasta, "eventos.db"), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(ESQUEMA)
        self.db.commit()

    # ---------- gravação

    def _salvar_imagem(self, imagem, relativo, largura=None, caixa=None):
        if imagem is None:
            return None
        if caixa is not None:
            imagem = imagem.copy()
            x1, y1, x2, y2 = (int(v) for v in caixa)
            cv2.rectangle(imagem, (x1, y1), (x2, y2), (0, 200, 255), 4)
        if largura and imagem.shape[1] > largura:
            escala = largura / imagem.shape[1]
            imagem = cv2.resize(imagem, (largura, int(imagem.shape[0] * escala)), interpolation=cv2.INTER_AREA)
        caminho = os.path.join(self.pasta_fotos, relativo)
        os.makedirs(os.path.dirname(caminho), exist_ok=True)
        cv2.imwrite(caminho, imagem, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return relativo

    def gravar(self, camera_id, passagem):
        momento = datetime.fromtimestamp(passagem.instante)
        base = momento.strftime("%Y/%m/%d/%H%M%S") + f"_{int((passagem.instante % 1) * 1000):03d}_{passagem.direcao}"
        foto = self._salvar_imagem(passagem.foto, base + ".jpg", LARGURA_FOTO, passagem.foto_caixa)
        foto_placa = self._salvar_imagem(passagem.recorte_placa, base + "_placa.jpg")
        with self._trava:
            cur = self.db.execute(
                """INSERT INTO passagens (camera_id, instante, inicio, direcao, classe, placa, confianca,
                   leituras_placa, leituras_validas, tentativas_placa, duracao, foto, foto_placa)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (camera_id, passagem.instante, passagem.inicio, passagem.direcao, passagem.classe, passagem.placa,
                 passagem.confianca, passagem.leituras_placa, passagem.leituras_validas,
                 passagem.tentativas_placa, passagem.duracao, foto, foto_placa),
            )
            self.db.commit()
            return cur.lastrowid

    # ---------- consulta

    def consultar(self, sql, parametros=()):
        with self._trava:
            return [dict(l) for l in self.db.execute(sql, parametros).fetchall()]

    def executar(self, sql, parametros=(), muitos=False):
        with self._trava:
            if muitos:
                self.db.executemany(sql, parametros)
            else:
                self.db.execute(sql, parametros)
            self.db.commit()

    def caminho_foto(self, relativo):
        """Caminho absoluto de uma foto, sem permitir sair da pasta de fotos."""
        caminho = os.path.realpath(os.path.join(self.pasta_fotos, relativo))
        if not caminho.startswith(os.path.realpath(self.pasta_fotos) + os.sep):
            return None
        return caminho if os.path.isfile(caminho) else None

    # ---------- retenção

    def _arquivos(self):
        arquivos = []
        for raiz, _, nomes in os.walk(self.pasta_fotos):
            for nome in nomes:
                caminho = os.path.join(raiz, nome)
                try:
                    st = os.stat(caminho)
                except FileNotFoundError:
                    continue
                arquivos.append((st.st_mtime, st.st_size, caminho))
        return sorted(arquivos)

    def limpar(self, agora=None):
        """Apaga fotos com mais de `dias` e, se ainda passar do limite, as mais antigas. Retorna quantas apagou."""
        agora = agora or time.time()
        corte = agora - self.dias * 86400
        arquivos = self._arquivos()
        total = sum(a[1] for a in arquivos)
        apagados = 0
        for mtime, tamanho, caminho in arquivos:
            if mtime >= corte and total <= self.limite_bytes:
                break
            try:
                os.remove(caminho)
            except FileNotFoundError:
                pass
            total -= tamanho
            apagados += 1
        self.executar("DELETE FROM passagens WHERE instante < ?", (corte,))
        self.executar("DELETE FROM so_camera WHERE instante < ?", (corte,))
        # pastas de dias que ficaram vazias
        for raiz, pastas, nomes in os.walk(self.pasta_fotos, topdown=False):
            if raiz != self.pasta_fotos and not pastas and not nomes:
                try:
                    os.rmdir(raiz)
                except OSError:
                    pass
        return apagados

    def espaco_usado(self):
        return sum(a[1] for a in self._arquivos())
