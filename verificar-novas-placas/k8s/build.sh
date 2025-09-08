#!/bin/bash

cd ..

VERSAO=1

docker build -t localhost:5001/digicam_verificar_novas_placas:$VERSAO .

docker push localhost:5001/digicam_verificar_novas_placas:$VERSAO

cd -
