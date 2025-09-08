#!/bin/bash

cd ..

VERSAO=1

docker build -t localhost:5001/digicam_frontend:$VERSAO .

docker push localhost:5001/digicam_frontend:$VERSAO

cd -
