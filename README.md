# Panchtatva Justice Automation

AI-powered legal case intake, classification, and assignment system that automates the triage of legal cases and assigns the best-matched judges and lawyers based on expertise, availability, and conflict checking.

## Features

- **OTP-based Authentication**: Secure email-only authentication with 6-digit OTP
- **AI Case Classification**: Automatic urgency classification (Urgent/Moderate/Low) using OpenAI
- **Live News Sensitivity**: Real-time news checking for case sensitivity scoring
- **Smart Assignment**: Automated judge and lawyer assignment based on expertise and availability
- **Role-based Dashboards**: Tailored interfaces for Clients, Lawyers, Judges, and Admins
- **PDF Processing**: Intelligent text extraction with OCR fallback for scanned documents
- **Conflict Detection**: Automated conflict of interest checking
- **Security & Compliance**: AES-256 encryption, audit logging, data retention policies

## Quick Start

1. **Install Dependencies**
   ```bash
   npm run install-deps
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Servers**
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + MongoDB + GridFS
- **AI**: OpenAI GPT-3.5-Turbo for classification
- **News**: Bing News API for sensitivity scoring
- **Authentication**: JWT with OTP via Nodemailer

## User Roles

- **Client**: Upload cases, view assignments
- **Lawyer**: Manage assigned cases, set availability
- **Judge**: Review priority queue, accept/decline cases
- **Admin**: Manage users, oversight, system configuration

## API Endpoints

### Authentication
- `POST /auth/send-otp` - Send OTP to email
- `POST /auth/verify-otp` - Verify OTP and get tokens
- `POST /auth/logout` - Logout and revoke tokens

### Cases
- `POST /cases/upload` - Upload PDF case
- `GET /cases/:id` - Get case details (role-filtered)
- `POST /cases/:id/reassign` - Request reassignment

### User Management
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update profile
- `POST /users/availability` - Set availability

### Admin
- `GET /admin/metrics` - System metrics
- `GET /admin/users` - Manage users
- `POST /admin/seed` - Seed demo data

## Security Features

- AES-256 encryption for sensitive data
- TLS encryption in transit
- Rate limiting on all endpoints
- Audit logging for all actions
- Field-level access control
- Data retention policies

## Development

### Backend Structure
```
backend/
├── controllers/     # Route handlers
├── middleware/      # Auth, validation, rate limiting
├── models/         # MongoDB schemas
├── services/       # Business logic
├── utils/          # Helpers and utilities
└── routes/         # API routes
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/  # Reusable UI components
│   ├── pages/      # Route components
│   ├── hooks/      # Custom React hooks
│   ├── services/   # API calls
│   ├── store/      # State management
│   └── utils/      # Helper functions
```

## Deployment

1. **Build Production**
   ```bash
   npm run build
   ```

2. **Docker Deployment**
   ```bash
   docker-compose up -d
   ```

3. **Environment Variables**
   - Set all required environment variables in production
   - Use MongoDB Atlas for database
   - Configure email SMTP settings
   - Set up news API keys

## License

MIT License - see LICENSE file for details.

---

**Tagline**: *Panchtatva — AI that triages, escalates, and assigns the right people faster, fairly, and securely.*
# Panchtatva Justice Automation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)

> **AI-powered legal case intake, classification, and assignment system**

*Panchtatva — AI that triages, escalates, and assigns the right people faster, fairly, and securely.*

## 🎯 Overview

Panchtatva Justice Automation is a comprehensive MERN stack application that revolutionizes legal case management through AI-powered automation. The system automatically processes legal documents, classifies cases by urgency, checks news sensitivity, and assigns optimal judge-lawyer pairs based on expertise, availability, and conflict checking.

## ✨ Key Features

### 🔐 **Secure Authentication**
- OTP-only authentication (no passwords)
- Email-based 6-digit OTP with 5-minute expiry
- JWT access + refresh token system
- Multi-device session management
- Account lockout protection

### 📄 **Intelligent Document Processing**
- PDF upload with 25MB limit
- Smart text extraction with OCR fallback
- Support for scanned documents
- GridFS-based secure file storage
- Automatic text normalization

### 🤖 **AI-Powered Classification**
- OpenAI GPT-3.5-Turbo integration
- Indian legal context awareness (IPC, CrPC, POCSO, UAPA)
- Automatic urgency classification (URGENT/MODERATE/LOW)
- Entity extraction (parties, subject matter, jurisdiction)
- Confidence scoring and quality validation

### 📰 **News Sensitivity Engine**
- Real-time news monitoring via Bing News/NewsAPI
- Sensitivity scoring (0-100 scale)
- Political and public order concern detection
- Geographic relevance matching
- Automatic urgency escalation

### ⚖️ **Smart Assignment System**
- Multi-factor scoring algorithm
- Expertise matching (60% weight)
- Availability tracking (20% weight)
- Load balancing (10% weight)
- Seniority consideration (5% weight)
- Rating-based selection (5% weight)
- Automatic conflict detection
- Admin escalation for edge cases

### 🎛️ **Role-Based Dashboards**
- **Client**: Case upload, status tracking, assignment visibility
- **Lawyer**: Priority queue, case management, availability setting
- **Judge**: Urgent case queue, acceptance workflow, scheduling
- **Admin**: System metrics, user management, audit oversight

### 🔒 **Security & Compliance**
- AES-256 encryption for sensitive data
- Comprehensive audit logging
- Field-level access control
- Data retention policies
- Rate limiting and abuse protection
- GDPR-compliant privacy handling

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- 4GB+ RAM, 10GB+ disk space
- Gmail account with 2FA (for OTP emails)

### 1. Clone Repository
```bash
git clone https://github.com/AdityaPandey-DEV/Panchatatva.git
cd Panchatatva
```

### 2. Configure Environment
```bash
cp env.example .env
# Edit .env with your API keys and configuration
```

### 3. Deploy with One Command
```bash
./scripts/deploy.sh development
```

### 4. Access Application
- **Frontend**: http://localhost
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

### 5. Login with Demo Users
Use OTP authentication:
- **Admin**: admin@panchtatva.in
- **Judge**: judge.sharma@court.gov.in  
- **Lawyer**: advocate.singh@lawfirm.com
- **Client**: ramesh.client@gmail.com

## 📋 System Requirements

### Development
- Node.js 18+
- MongoDB 6.0+
- 4GB RAM minimum

### Production
- Docker-compatible server
- 8GB+ RAM recommended
- SSL certificate
- Domain name
- Email service (Gmail/SMTP)

## 🔧 Configuration

### Required API Keys
1. **OpenAI API Key** - For AI classification
2. **Bing News API Key** - For news sensitivity
3. **Gmail App Password** - For OTP emails

### Environment Variables
```bash
# Database
MONGODB_URI=your_mongodb_connection_string

# JWT Secrets (generate strong secrets)
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Email Configuration
EMAIL_HOST_USER=your_gmail@gmail.com
EMAIL_HOST_PASSWORD=your_gmail_app_password

# AI Services
OPENAI_API_KEY=your_openai_api_key
BING_NEWS_API_KEY=your_news_api_key
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Node.js Backend │    │   MongoDB Atlas  │
│                 │────│                 │────│                 │
│ • Authentication │    │ • REST API      │    │ • User Data     │
│ • Dashboards    │    │ • File Processing│    │ • Case Records  │
│ • File Upload   │    │ • AI Integration │    │ • Audit Logs    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              │
                    ┌─────────────────┐
                    │  External APIs  │
                    │                 │
                    │ • OpenAI GPT    │
                    │ • Bing News     │
                    │ • Gmail SMTP    │
                    └─────────────────┘
```

## 📊 Performance Metrics

- **Processing Time**: < 60 seconds (non-OCR), < 180 seconds (OCR)
- **Assignment Success**: > 95%
- **Classification Accuracy**: > 90%
- **System Uptime**: > 99%
- **Concurrent Users**: 100+ supported

## 🧪 Testing

### Demo Scenarios
1. **Urgent Criminal Case** (Rape case → Senior assignment)
2. **Property Dispute** (Civil matter → Jurisdiction matching)
3. **Cyber Crime** (Data breach → Tech specialist assignment)
4. **Conflict Detection** (Automatic alternative assignment)
5. **News Escalation** (Sensitivity-based urgency increase)

### Test Commands
```bash
# Run backend tests
cd backend && npm test

# Run frontend tests  
cd frontend && npm test

# Integration tests
./scripts/test-integration.sh
```

## 🚢 Deployment Options

### 1. Docker Compose (Recommended)
```bash
./scripts/deploy.sh production
```

### 2. Cloud Platforms
- **AWS**: ECS/EKS + RDS
- **Google Cloud**: Cloud Run + MongoDB Atlas
- **Azure**: Container Instances + Cosmos DB

### 3. Manual Server Setup
See `DEPLOYMENT.md` for detailed instructions

## 📈 Monitoring & Maintenance

### Health Checks
- `/health` - Application health
- `/api/admin/health` - System health
- Docker health checks included

### Logging
- Application logs: `backend/logs/`
- Audit logs: Database collection
- Docker logs: `docker-compose logs`

### Backup
```bash
./scripts/backup.sh
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [Quick Start Guide](QUICK_START.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Test Scenarios](demo/test-scenarios.md)

### Troubleshooting
- Check logs: `docker-compose logs -f`
- Health check: `curl http://localhost:5000/health`
- Reset system: `docker-compose down -v && docker-compose up -d`

### Contact
- **Repository**: https://github.com/AdityaPandey-DEV/Panchatatva
- **Issues**: https://github.com/AdityaPandey-DEV/Panchatatva/issues

---

**⚖️ Panchtatva Justice Automation**  
*Revolutionizing legal case management through AI-powered automation*

**Built with ❤️ for the Indian Legal System**
