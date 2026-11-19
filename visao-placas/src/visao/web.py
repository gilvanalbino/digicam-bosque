"""
Página do protótipo. O HTML em /visao/ é público e não tem dados; tudo em /visao/api/ passa pelo nginx, que
confere o login no backend (auth_request) antes de repassar. As fotos também vêm pela API.
"""

import os
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from .comparacao import DESCRICOES

PAGINA = os.path.join(os.path.dirname(__file__), "pagina.html")


def _limites_dia(dia):
    try:
        inicio = datetime.strptime(dia, "%Y-%m-%d") if dia else datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0)
    except ValueError as erro:
        raise HTTPException(400, "dia inválido (use AAAA-MM-DD)") from erro
    return inicio.timestamp(), (inicio + timedelta(days=1)).timestamp()


def criar_app(armazenamento, estado, config):
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    camera_id = config["camera_id"]

    @app.get("/visao/", response_class=HTMLResponse)
    def pagina():
        with open(PAGINA, encoding="utf-8") as f:
            return f.read()

    @app.get("/visao/api/status")
    def status():
        dados = estado.como_dict()
        dados["camera"] = config.get("nome_camera", f"câmera {camera_id}")
        dados["espaco_usado_mb"] = round(armazenamento.espaco_usado() / 1024**2, 1)
        return dados

    @app.get("/visao/api/resumo")
    def resumo(dia: str = None):
        inicio, fim = _limites_dia(dia)
        linhas = armazenamento.consultar(
            "SELECT COALESCE(comparacao, 'pendente') categoria, classe, COUNT(*) qtd FROM passagens "
            "WHERE camera_id=? AND instante>=? AND instante<? GROUP BY categoria, classe",
            (camera_id, inicio, fim),
        )
        so_camera = armazenamento.consultar(
            "SELECT COUNT(*) qtd FROM so_camera WHERE camera_id=? AND instante>=? AND instante<?",
            (camera_id, inicio, fim),
        )[0]["qtd"]
        categorias = {}
        for l in linhas:
            c = categorias.setdefault(l["categoria"], {"total": 0, "por_classe": {}})
            c["total"] += l["qtd"]
            c["por_classe"][l["classe"]] = l["qtd"]
        categorias["so_camera"] = {"total": so_camera, "por_classe": {}}
        return {"categorias": categorias, "descricoes": {**DESCRICOES, "pendente": "Aguardando comparação"}}

    @app.get("/visao/api/passagens")
    def passagens(dia: str = None, categoria: str = None, limite: int = 300):
        inicio, fim = _limites_dia(dia)
        if categoria == "so_camera":
            return armazenamento.consultar(
                "SELECT trafego_id, instante, placa FROM so_camera WHERE camera_id=? AND instante>=? AND instante<? "
                "ORDER BY instante DESC LIMIT ?", (camera_id, inicio, fim, limite))
        sql = ("SELECT id, instante, direcao, classe, placa, confianca, leituras_placa, leituras_validas, "
               "tentativas_placa, duracao, foto, foto_placa, COALESCE(comparacao, 'pendente') comparacao, "
               "camera_placa, camera_instante, trafego_id FROM passagens WHERE camera_id=? AND instante>=? "
               "AND instante<?")
        parametros = [camera_id, inicio, fim]
        if categoria:
            sql += " AND COALESCE(comparacao, 'pendente')=?"
            parametros.append(categoria)
        sql += " ORDER BY instante DESC LIMIT ?"
        parametros.append(min(limite, 2000))
        return armazenamento.consultar(sql, parametros)

    @app.get("/visao/api/foto/{relativo:path}")
    def foto(relativo: str):
        caminho = armazenamento.caminho_foto(relativo)
        if not caminho:
            raise HTTPException(404, "foto não encontrada (pode ter sido apagada pela retenção)")
        return FileResponse(caminho, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=86400"})

    return app
