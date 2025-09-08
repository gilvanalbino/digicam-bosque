### STAGE 1: Build ###
#FROM node:14.13-slim as build
FROM node:16.15-slim as build

WORKDIR /app

COPY ./package.json      .
COPY ./package-lock.json .

RUN npm install

COPY ./public   ./public
COPY ./index.html .
COPY ./postcss.config.js .
COPY ./tailwind.config.js .
COPY ./vite.config.js .
COPY ./src   ./src
COPY .env.production .env

RUN npm run build

### STAGE 2: Production Environment ###
FROM nginx:alpine

RUN apk add --no-cache tzdata
ENV TZ America/Bahia

COPY --from=build /app/dist /var/www
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx","-g","daemon off;"]
