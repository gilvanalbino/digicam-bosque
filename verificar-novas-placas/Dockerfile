# FROM node:16.20.2
FROM node:18-bullseye

WORKDIR /app

COPY ./package.json      .
COPY ./package-lock.json .

RUN apt-get update && apt-get install -y vim-tiny

RUN npm install

COPY ./src   ./src

CMD ["npm", "start"]
