# Panchtatva Justice Automation - Quick Start Guide

## 🚀 Quick Deployment

### Prerequisites
- Docker and Docker Compose installed
- Git installed
- 4GB+ RAM available
- 10GB+ disk space

### 1. Clone and Setup
```bash
git clone https://github.com/AdityaPandey-DEV/Panchatatva.git
cd Panchatatva
```

### 2. Environment Configuration
```bash
# Copy environment template
cp env.example .env

# Edit .env file with your settings
nano .env
```

**Required Environment Variables:**
```bash
# Database (use default for quick start)
MONGODB_URI=mongodb://admin:panchtatva2024@mongodb:27017/panchtatva-justice?authSource=admin

# JWT Secrets (generate strong secrets)
JWT_SECRET=your-super-secure-jwt-secret-change-this
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-change-this

# Email (Gmail App Password required)
EMAIL_HOST_USER=your-gmail@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password

# AI (Optional - for AI classification)
OPENAI_API_KEY=sk-your-openai-api-key

# News API (Optional - for news sensitivity)
BING_NEWS_API_KEY=your-bing-news-api-key
```

### 3. Deploy with One Command
```bash
./scripts/deploy.sh development
```

### 4. Access the Application
- **Frontend**: http://localhost
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

### 5. Demo Login
Use OTP authentication with these demo emails:
- **Admin**: admin@panchtatva.in
- **Judge**: judge.sharma@court.gov.in
- **Lawyer**: advocate.singh@lawfirm.com
- **Client**: ramesh.client@gmail.com

## 🔧 Manual Setup (Alternative)

### Backend Setup
```bash
cd backend
npm install
cp ../env.example .env
# Edit .env with your configuration
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Database Setup
```bash
# Start MongoDB (if running locally)
mongod

# Seed demo data
cd backend
node ../demo/seed-data.js
```

## 📊 System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 10GB
- **Network**: Internet connection for AI/News APIs

### Recommended for Production
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: High-speed internet

## 🔑 API Keys Setup

### Gmail App Password
1. Enable 2-Factor Authentication on Gmail
2. Go to Google Account Settings
3. Generate App Password for "Mail"
4. Use this password in `EMAIL_HOST_PASSWORD`

### OpenAI API Key
1. Visit https://platform.openai.com
2. Create account and get API key
3. Add to `OPENAI_API_KEY`

### Bing News API
1. Visit https://www.microsoft.com/en-us/bing/apis/bing-news-search-api
2. Get API key
3. Add to `BING_NEWS_API_KEY`

## 🐳 Docker Commands

### Start Services
```bash
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Stop Services
```bash
docker-compose down
```

### Restart Service
```bash
docker-compose restart backend
```

### Shell Access
```bash
docker-compose exec backend sh
docker-compose exec mongodb mongo
```

## 🧪 Testing the System

### 1. Upload Test Case
1. Login as client (ramesh.client@gmail.com)
2. Upload a PDF file
3. Monitor processing in real-time

### 2. Judge Workflow
1. Login as judge (judge.sharma@court.gov.in)
2. Check priority queue
3. Accept/decline assignments

### 3. Lawyer Workflow
1. Login as lawyer (advocate.singh@lawfirm.com)
2. View assigned cases
3. Manage availability

### 4. Admin Monitoring
1. Login as admin (admin@panchtatva.in)
2. View system metrics
3. Monitor audit logs

## 🚨 Troubleshooting

### Common Issues

**OTP Not Received**
- Check Gmail app password
- Verify 2FA is enabled
- Check spam folder

**Docker Issues**
```bash
# Clean up Docker
docker-compose down -v
docker system prune -f
docker-compose up --build -d
```

**Database Connection Failed**
```bash
# Check MongoDB container
docker-compose logs mongodb

# Restart database
docker-compose restart mongodb
```

**Build Failures**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Health Checks
```bash
# Backend health
curl http://localhost:5000/health

# Frontend health
curl http://localhost/health

# Database health
docker-compose exec mongodb mongo --eval "db.adminCommand('ismaster')"
```

## 📈 Production Deployment

### Cloud Deployment
1. **AWS**: Use ECS/EKS with RDS MongoDB
2. **Google Cloud**: Use Cloud Run with MongoDB Atlas
3. **Azure**: Use Container Instances with Cosmos DB

### SSL Configuration
```bash
# Using Let's Encrypt
certbot --nginx -d your-domain.com
```

### Environment Variables
Set these in production:
- `NODE_ENV=production`
- `MONGODB_URI=<production-mongodb-uri>`
- Strong JWT secrets
- Production email credentials
- Valid SSL certificates

## 📞 Support

### Documentation
- Full deployment guide: `DEPLOYMENT.md`
- Test scenarios: `demo/test-scenarios.md`
- API documentation: Available after deployment at `/api/docs`

### Monitoring
- Application logs: `backend/logs/`
- Docker logs: `docker-compose logs`
- Health endpoints: `/health` and `/api/health`

### Backup
```bash
# Create backup
./scripts/backup.sh

# Restore from backup
# See DEPLOYMENT.md for restore procedures
```

---

**🎯 Ready to Deploy!**

The system is now ready for deployment. Follow this quick start guide to get Panchtatva Justice Automation running in minutes!

For production deployment, refer to the comprehensive `DEPLOYMENT.md` guide.
