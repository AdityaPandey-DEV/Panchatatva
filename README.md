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
# Panchatatva
