"""Leitura do vídeo (RTSP da câmera ou arquivo gravado) entregando ~N quadros por segundo."""

import logging
import time

import av

log = logging.getLogger("visao.captura")


def quadros(url, qps=5.0, arquivo=False, inicio_arquivo=None, parar=lambda: False):
    """
    Gera (instante, quadro BGR). Ao vivo, o instante é o relógio da máquina no momento da decodificação e a
    conexão é refeita sozinha se cair. Em arquivo, o instante vem do tempo do vídeo somado a `inicio_arquivo`.
    Só os quadros escolhidos são convertidos para imagem; os outros são apenas decodificados.
    """
    intervalo = 1.0 / qps
    espera = 2.0
    while not parar():
        try:
            opcoes = {} if arquivo else {"rtsp_transport": "tcp", "stimeout": "10000000", "timeout": "10000000"}
            entrada = av.open(url, options=opcoes, timeout=(15, 15) if not arquivo else None)
        except Exception as erro:  # noqa: BLE001 - qualquer falha de rede vira nova tentativa
            if arquivo:
                raise
            log.warning("não conectou ao vídeo (%s); nova tentativa em %.0f s", erro, espera)
            time.sleep(espera)
            espera = min(espera * 2, 60)
            continue
        espera = 2.0
        log.info("vídeo aberto: %s", url.split("@")[-1])
        fluxo = entrada.streams.video[0]
        fluxo.thread_type = "AUTO"
        proximo = 0.0
        try:
            for quadro in entrada.decode(fluxo):
                if parar():
                    break
                if arquivo:
                    t_video = float(quadro.time or 0.0)
                    if t_video < proximo:
                        continue
                    proximo = t_video + intervalo
                    instante = (inicio_arquivo or 0.0) + t_video
                else:
                    instante = time.time()
                    if instante < proximo:
                        continue
                    proximo = instante + intervalo
                yield instante, quadro.to_ndarray(format="bgr24")
        except Exception as erro:  # noqa: BLE001
            if arquivo:
                raise
            log.warning("vídeo interrompido (%s); reconectando", erro)
        finally:
            entrada.close()
        if arquivo:
            return
