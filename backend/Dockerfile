# FROM node:14.13-slim
FROM node:16-buster-slim

#RUN apt-get update && apt-get install -y \
#  vim curl telnet gettext-base

WORKDIR /app

COPY ./package.json      .
COPY ./package-lock.json .

RUN npm install

COPY ./config   ./config
COPY ./controllers ./controllers
COPY ./migrations ./migrations
COPY ./models ./models
COPY ./routes ./routes
COPY ./services ./services
COPY ./src   ./src

COPY ./api.js ./api.js
COPY ./bootstrap.js ./bootstrap.js
COPY ./database.js ./database.js
COPY ./server.js ./server.js

COPY /entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

ENTRYPOINT [ "entrypoint.sh" ]

