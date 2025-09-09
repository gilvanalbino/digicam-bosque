# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a digital camera license plate recognition system for condominium access control. The system consists of four main components:

1. **frontend/** - Vue 3 + Vite client application with Tailwind CSS
2. **backend/** - Node.js backend using Hapi.js framework with MySQL database
3. **servidor-imagens/** - Image server component
4. **verificar-novas-placas/** - License plate verification service

## Development Commands

### Frontend (Vue 3 + Vite)
```bash
cd frontend
npm run dev    # Start development server
npm run build  # Build for production
npm run preview # Preview production build
```

### Backend (Node.js + Hapi)
```bash
cd backend
npm run dev    # Development mode with NODE_ENV=development
npm start      # Production mode with NODE_ENV=production
npm run placas # Run plates service
```

### License Plate Verification Service
```bash
cd verificar-novas-placas
npm run dev    # Development mode
npm start      # Production mode
```

## Database Setup

The system uses MySQL with Sequelize ORM. Database setup commands:

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
# Generate models
npx sequelize-cli model:generate --name User --attributes email:string,password:string,active:boolean

# Run migrations
sequelize db:migrate
sequelize db:migrate:undo

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

### Camera Integration
- Connects to Hikvision IP cameras via digest authentication
- Endpoints:
  - Image capture: `/ISAPI/Streaming/channels/101/picture`
  - License plate detection: `/ISAPI/Traffic/channels/101/vehicleDetect/plates`
- Uses digest auth (admin / digitt@2008)

## Deployment

The project is containerized with Docker and deployed on Kubernetes. Each component has its own Dockerfile and k8s configuration.

## Monitoring

Use kubectl logs to monitor services:
```bash
klogs digicam-verificar-novas-placas-[pod-id] -f | grep 'Inserindo placa:'
klogs -f digicam-backend-[pod-id] | grep "Encontrou entrada - registrou saida"
```