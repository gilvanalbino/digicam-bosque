# Development stage
FROM node:16-buster-slim as development

# Install development dependencies
RUN apt-get update && apt-get install -y \
  curl \
  telnet \
  gettext-base \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY ./package.json ./package-lock.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Create images directory
RUN mkdir -p /app/images

EXPOSE 4000

# Development command (will be overridden by docker-compose)
CMD ["npm", "run", "dev"]

# Production stage  
FROM node:16-buster-slim as production

WORKDIR /app

# Copy package files
COPY ./package.json ./package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY ./config   ./config
COPY ./controllers ./controllers
COPY ./middleware ./middleware
COPY ./migrations ./migrations
COPY ./models ./models
COPY ./routes ./routes
COPY ./services ./services
COPY ./src   ./src

COPY ./api.js ./api.js
COPY ./bootstrap.js ./bootstrap.js
COPY ./database.js ./database.js
COPY ./server.js ./server.js

# Copy entrypoint script
COPY ./entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create images directory
RUN mkdir -p /app/images

EXPOSE 4000

ENTRYPOINT ["entrypoint.sh"]

