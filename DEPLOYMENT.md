# Panchtatva Justice Automation - Deployment Guide

## Prerequisites

### System Requirements
- Node.js 18+ and npm
- MongoDB 6.0+
- Redis (recommended for production)
- SSL certificates (for production)

### API Keys Required
- **OpenAI API Key**: For AI classification
- **Bing News API Key** OR **NewsAPI Key**: For news sensitivity checking
- **Gmail App Password**: For OTP email delivery

## Environment Configuration

### Backend (.env)
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/panchtatva-justice
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/panchtatva-justice

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_change_this_in_production
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_change_this_too
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password

# AI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# News API Configuration
NEWS_PROVIDER=BING
BING_NEWS_API_KEY=your-bing-news-api-key
# Alternative: NEWSAPI_KEY=your-newsapi-key

# Application
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-domain.com

# Security
ENCRYPTION_KEY=your-32-character-encryption-key-here
BCRYPT_ROUNDS=12

# File Upload
MAX_FILE_SIZE=26214400
UPLOAD_PATH=uploads/

# Rate Limiting
OTP_RATE_LIMIT_WINDOW=15
OTP_RATE_LIMIT_MAX=5
API_RATE_LIMIT_WINDOW=15
API_RATE_LIMIT_MAX=100

# Data Retention
CASE_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_DAYS=365
```

### Frontend (.env)
```bash
VITE_API_URL=https://your-api-domain.com/api
```

## Local Development Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd panchtatva-justice-automation

# Install root dependencies
npm install

# Install backend and frontend dependencies
npm run install-deps
```

### 2. Setup Environment Variables
```bash
# Copy environment template
cp env.example .env

# Edit .env with your configuration
nano .env

# Setup frontend environment
cd frontend
cp .env.example .env.local
# Edit with your API URL
```

### 3. Setup Database
```bash
# Start MongoDB (if running locally)
mongod

# Seed demo data
cd backend
node ../demo/seed-data.js
```

### 4. Start Development Servers
```bash
# Start both backend and frontend
npm run dev

# Or start individually:
npm run server  # Backend only
npm run client  # Frontend only
```

### 5. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## Production Deployment

### Option 1: Docker Deployment

#### Create Docker Files

**backend/Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

**frontend/Dockerfile**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml**
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: panchtatva-db
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: secure_password

  redis:
    image: redis:7-alpine
    container_name: panchtatva-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    container_name: panchtatva-api
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://admin:secure_password@mongodb:27017/panchtatva-justice?authSource=admin
    env_file:
      - .env
    depends_on:
      - mongodb
      - redis
    volumes:
      - ./logs:/app/logs

  frontend:
    build: ./frontend
    container_name: panchtatva-web
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    volumes:
      - ./ssl:/etc/nginx/ssl

volumes:
  mongodb_data:
  redis_data:
```

#### Deploy with Docker
```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Seed database
docker-compose exec backend node ../demo/seed-data.js
```

### Option 2: Cloud Deployment (AWS/GCP/Azure)

#### Backend Deployment
1. **Database**: Use MongoDB Atlas or cloud MongoDB service
2. **Application**: Deploy to AWS ECS, Google Cloud Run, or Azure Container Instances
3. **File Storage**: Use AWS S3, Google Cloud Storage, or Azure Blob Storage
4. **Load Balancer**: Setup with SSL termination
5. **Monitoring**: CloudWatch, Google Cloud Monitoring, or Azure Monitor

#### Frontend Deployment
1. **Build**: `npm run build`
2. **Deploy**: AWS S3 + CloudFront, Vercel, Netlify, or similar
3. **SSL**: Automatic with most platforms

### Option 3: VPS/Dedicated Server

#### Setup Process
```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# 4. Install Nginx
sudo apt install nginx -y

# 5. Install PM2 for process management
sudo npm install -g pm2

# 6. Setup application
git clone <repository-url>
cd panchtatva-justice-automation
npm run install-deps

# 7. Configure environment
cp env.example .env
# Edit .env with production values

# 8. Build frontend
cd frontend
npm run build
cd ..

# 9. Start backend with PM2
pm2 start backend/server.js --name "panchtatva-api"
pm2 startup
pm2 save

# 10. Configure Nginx
sudo nano /etc/nginx/sites-available/panchtatva
```

**Nginx Configuration**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Frontend
    location / {
        root /path/to/panchtatva-justice-automation/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Post-Deployment Steps

### 1. Database Seeding
```bash
# Seed demo users and data
node demo/seed-data.js
```

### 2. SSL Certificate Setup
```bash
# Using Certbot (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. Monitoring Setup
- Setup log rotation
- Configure monitoring alerts
- Setup backup schedules
- Monitor API usage and performance

### 4. Security Hardening
- Enable firewall (UFW/iptables)
- Setup fail2ban for brute force protection
- Regular security updates
- Monitor audit logs

## Testing the Deployment

### 1. Health Checks
```bash
# Backend health
curl https://your-domain.com/api/health

# Database connectivity
curl https://your-domain.com/api/admin/health
```

### 2. Demo Workflow
1. **Access**: https://your-domain.com
2. **Login**: Use demo user emails (check seed-data.js)
3. **Upload Case**: Use client account to upload a PDF
4. **Monitor Processing**: Check case status and assignments
5. **Role Testing**: Test judge, lawyer, and admin dashboards

### 3. Performance Testing
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test API performance
ab -n 1000 -c 10 https://your-domain.com/api/health
```

## Backup and Recovery

### Database Backup
```bash
# Create backup
mongodump --uri="mongodb://localhost:27017/panchtatva-justice" --out=/backup/$(date +%Y%m%d)

# Restore backup
mongorestore --uri="mongodb://localhost:27017/panchtatva-justice" /backup/20231201/panchtatva-justice
```

### File Backup
```bash
# Backup uploaded files and logs
tar -czf backup-$(date +%Y%m%d).tar.gz logs/ uploads/
```

## Troubleshooting

### Common Issues

1. **OTP Not Sending**
   - Check EMAIL_HOST_PASSWORD is Gmail App Password
   - Verify Gmail 2FA is enabled
   - Check SMTP settings

2. **AI Classification Failing**
   - Verify OPENAI_API_KEY is valid
   - Check API quota and billing
   - Monitor rate limits

3. **News API Issues**
   - Verify NEWS_API_KEY
   - Check API quotas
   - Fallback to alternative provider

4. **File Upload Errors**
   - Check MAX_FILE_SIZE setting
   - Verify GridFS setup
   - Monitor disk space

### Log Locations
- Application: `logs/combined.log`
- Errors: `logs/error.log`
- PM2: `~/.pm2/logs/`
- Nginx: `/var/log/nginx/`

### Performance Optimization
- Enable MongoDB indexing
- Setup Redis caching
- Configure CDN for static assets
- Enable gzip compression
- Optimize database queries

## Security Checklist

- [ ] Environment variables secured
- [ ] JWT secrets are strong and unique
- [ ] Database access restricted
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] Audit logging active
- [ ] Regular backups scheduled
- [ ] Monitoring alerts configured
- [ ] Security headers configured

## Support and Maintenance

### Regular Tasks
- Monitor system resources
- Check error logs
- Update dependencies
- Review audit logs
- Backup verification
- Performance monitoring
- Security patches

### Scaling Considerations
- Horizontal scaling with load balancers
- Database sharding for large datasets
- CDN for global distribution
- Microservices architecture
- Containerization with Kubernetes

For additional support, refer to the main README.md and API documentation.
