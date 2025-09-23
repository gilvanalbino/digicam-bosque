# Development stage
FROM node:18-bullseye as development

# Install development dependencies
RUN apt-get update && apt-get install -y \
  curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY ./package.json ./package-lock.json ./

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Create images directory
RUN mkdir -p /app/images

EXPOSE 5000

# Development command
CMD ["npm", "run", "dev"]

# Production stage
FROM node:18-bullseye as production

WORKDIR /app

# Copy package files
COPY ./package.json ./package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY ./src ./src
COPY ./public ./public

# Create images directory
RUN mkdir -p /app/images

EXPOSE 5000

CMD ["npm", "start"]