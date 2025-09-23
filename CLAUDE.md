# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a digital camera license plate recognition system for condominium access control. The system consists of four main components:

1. **frontend/** - Vue 3 + Vite client application with Tailwind CSS
2. **backend/** - Node.js backend using Hapi.js framework with MySQL database
3. **servidor-imagens/** - Image server component
4. **verificar-novas-placas/** - License plate verification service

## Development Commands

### Using Docker Compose (Recommended for Development)
```bash
# Start all services in development mode
docker-compose up -d

# View logs from all services
docker-compose logs -f

# View logs from specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Rebuild and start (after code changes to Dockerfiles)
docker-compose up -d --build

# Remove all containers and volumes (clean slate)
docker-compose down -v --remove-orphans
```

### Linting and Testing
Note: This codebase currently does not have lint or test scripts configured in package.json files. Consider adding these for better code quality:

### Individual Services (Without Docker)

#### Frontend (Vue 3 + Vite)
```bash
cd frontend
npm run dev    # Start development server
npm run build  # Build for production
npm run preview # Preview production build
```

#### Backend (Node.js + Hapi)
```bash
cd backend
npm run dev    # Development mode with NODE_ENV=development
npm start      # Production mode with NODE_ENV=production
npm run placas # Run plates service
```

#### License Plate Verification Service
```bash
cd verificar-novas-placas
npm run dev    # Development mode
npm start      # Production mode
```

#### Image Server (servidor-imagens)
```bash
cd servidor-imagens
# Static image server - no npm commands needed
# Serves images from shared volume at port 5000
```

## Database Setup

### With Docker Compose (Automatic)
When using docker-compose, the MySQL database is automatically configured with:
- Database: `digicam_db`
- User: `digicam_user`
- Password: `Digicam@123`
- Port: `3306` (accessible from host)

Access the database:
```bash
# Using Adminer web interface (included in docker-compose)
# Open: http://localhost:8080
# Server: mysql
# Username: digicam_user
# Password: Digicam@123
# Database: digicam_db

# Or using MySQL client
docker-compose exec mysql mysql -u digicam_user -p digicam_db
```

### Manual Database Setup (Without Docker)
```bash
# Start MySQL container
docker run -it --name mysql-digicam -e MYSQL_ROOT_PASSWORD=digicam123 -p 3306:3306 -d mysql --default-authentication-plugin=mysql_native_password

# Access MySQL
docker start mysql-digicam
docker exec -it mysql-digicam mysql -uroot -pdigicam123

# Create database and user
CREATE DATABASE digicam_db;
CREATE USER 'digicam_user'@'%' IDENTIFIED WITH mysql_native_password BY 'Digicam@123';
GRANT ALL ON digicam_db.* TO 'digicam_user'@'%';
```

## Sequelize Commands

```bash
# Run from backend directory
cd backend

# Generate models
npx sequelize-cli model:generate --name User --attributes email:string,password:string,active:boolean

# Run migrations
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:undo

# Generate new migration
npx sequelize-cli migration:generate --name [migration-name]
```

## Architecture

### Frontend Tech Stack
- Vue 3 with `<script setup>` composition API
- Vite for build tooling
- Tailwind CSS for styling
- Vue Router for navigation
- Vuex for state management
- Axios for HTTP requests

Key libraries:
- @headlessui/vue - Accessible UI components
- @vuelidate/core - Form validation
- dayjs - Date handling
- maska - Input masking
- notiwind - Notifications

### Backend Tech Stack
- Hapi.js web framework
- Sequelize ORM with MySQL
- JWT authentication (hapi-auth-jwt2)
- Image processing with Jimp and Sharp
- PDF generation with pdfmake
- Excel export with exceljs

Key models:
- User - System users
- Client - Condominiums/clients
- Camera - IP cameras configuration
- Trafego - Traffic/entry-exit records
- Morador - Residents
- Carro - Resident vehicles
- WhiteList/BlackList - Access control lists
- Portaria - Security gate/booth data
- LogIdentificacao - Identification logs

### Camera Integration
- Connects to Hikvision IP cameras via digest authentication
- Endpoints:
  - Image capture: `/ISAPI/Streaming/channels/101/picture`
  - License plate detection: `/ISAPI/Traffic/channels/101/vehicleDetect/plates`
- Uses digest auth (admin / digitt@2008)

## Development Environment

### Services and Ports
- **Frontend**: http://localhost:3000 (Vue 3 + Vite with hot reload)
- **Backend**: http://localhost:4000 (Node.js + Hapi.js API)
- **Image Server**: http://localhost:5000 (Static image serving)
- **Database**: localhost:3306 (MySQL 8.0)
- **Adminer**: http://localhost:8080 (Database management interface)

### Health Checks
- Backend health: http://localhost:4000/digicam/health
- All services have health checks configured in docker-compose

### Volumes and Persistence
- `mysql_data`: Persists database data
- `backend_images`: Shared volume for processed images
- Code is mounted as volumes for hot reload during development

### Environment Configuration
The project uses multiple .env files for configuration:
- `.env.development` - Root level development environment
- `backend/.env` - Backend-specific environment variables
- `frontend/.env` - Frontend environment configuration
- `frontend/.env.production` - Production frontend configuration
- `verificar-novas-placas/.env` - License plate service configuration

Key environment variables:
- Database connection (DATABASE_USER, DATABASE_PASS, etc.)
- JWT authentication keys
- Camera credentials (admin / digitt@2008)
- SFTP configuration for image transfer

## Deployment

The project is containerized with Docker and deployed on Kubernetes. Each component has its own Dockerfile and k8s configuration.

### Docker Compose Production
For production deployment with docker-compose:
```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Monitoring

Use kubectl logs to monitor services:
```bash
klogs digicam-verificar-novas-placas-[pod-id] -f | grep 'Inserindo placa:'
klogs -f digicam-backend-[pod-id] | grep "Encontrou entrada - registrou saida"
```