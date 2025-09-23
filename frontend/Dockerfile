# Development stage
FROM node:16.15-slim as development

WORKDIR /app

# Copy package files
COPY ./package.json ./package-lock.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

EXPOSE 3000

# Development command with hot reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage
FROM node:16.15-slim as build

WORKDIR /app

COPY ./package.json ./package-lock.json ./

RUN npm install

COPY ./public   ./public
COPY ./index.html .
COPY ./postcss.config.js .
COPY ./tailwind.config.js .
COPY ./vite.config.js .
COPY ./src   ./src
COPY .env.production .env

RUN npm run build

# Production stage
FROM nginx:alpine as production

RUN apk add --no-cache tzdata
ENV TZ America/Bahia

COPY --from=build /app/dist /var/www
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx","-g","daemon off;"]
