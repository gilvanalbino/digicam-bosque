# Identificação de entradas e saídas por software (docs/plano_identificacao_placas_software.md). Tudo em CPU.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HOME=/app OMP_NUM_THREADS=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# modelos baixados no build: em execução o serviço não depende da internet
# YOLOX-tiny (Apache-2.0): https://github.com/Megvii-BaseDetection/YOLOX
ADD https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx /modelos/yolox_tiny.onnx
# detector de placa e OCR do fast-alpr (MIT) ficam no cache do usuário (/app/.cache)
RUN python -c "from fast_alpr import ALPR; ALPR(detector_model='yolo-v9-t-384-license-plate-end2end', ocr_model='cct-xs-v2-global-model', ocr_device='cpu')" \
 && chmod -R a+rX /modelos /app/.cache

COPY src/ /app/src/
COPY config.yaml /app/config.yaml
ENV PYTHONPATH=/app/src

CMD ["python", "-m", "visao.servico"]
