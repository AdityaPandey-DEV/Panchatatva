#!/bin/bash

# Panchtatva Justice Automation - Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environment: development, staging, production

set -e

ENVIRONMENT=${1:-development}
PROJECT_NAME="panchtatva-justice"

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please copy env.example to .env and configure it."
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if required environment variables are set
check_env_var() {
    if [ -z "${!1}" ]; then
        echo "❌ Error: Environment variable $1 is not set in .env file"
        exit 1
    fi
}

echo "📋 Checking environment variables..."
source .env

# Essential variables
check_env_var "MONGODB_URI"
check_env_var "JWT_SECRET"
check_env_var "JWT_REFRESH_SECRET"
check_env_var "EMAIL_HOST_USER"
check_env_var "EMAIL_HOST_PASSWORD"

# Optional but recommended
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. AI classification will not work."
fi

if [ -z "$BING_NEWS_API_KEY" ] && [ -z "$NEWSAPI_KEY" ]; then
    echo "⚠️  Warning: No news API key set. News sensitivity checking will not work."
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backend/logs
mkdir -p backend/uploads
mkdir -p ssl

# Build and start services based on environment
case $ENVIRONMENT in
    "development")
        echo "🔧 Starting development environment..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
        ;;
    "staging")
        echo "🔧 Starting staging environment..."
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up --build -d
        ;;
    "production")
        echo "🔧 Starting production environment..."
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
        ;;
    *)
        echo "❌ Error: Invalid environment. Use: development, staging, or production"
        exit 1
        ;;
esac

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Health check
echo "🏥 Performing health checks..."
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    docker-compose logs backend
    exit 1
fi

if curl -f http://localhost/health > /dev/null 2>&1; then
    echo "✅ Frontend health check passed"
else
    echo "❌ Frontend health check failed"
    docker-compose logs frontend
    exit 1
fi

# Seed demo data if in development
if [ "$ENVIRONMENT" = "development" ]; then
    echo "🌱 Seeding demo data..."
    docker-compose exec backend node ../demo/seed-data.js || echo "⚠️  Demo data seeding failed (this is normal if data already exists)"
fi

echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Access URLs:"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:5000"
echo "Health Check: http://localhost:5000/health"

if [ "$ENVIRONMENT" = "development" ]; then
    echo ""
    echo "👤 Demo Users (use OTP login):"
    echo "Admin: admin@panchtatva.in"
    echo "Judge: judge.sharma@court.gov.in"
    echo "Lawyer: advocate.singh@lawfirm.com"
    echo "Client: ramesh.client@gmail.com"
fi

echo ""
echo "📝 Useful commands:"
echo "View logs: docker-compose logs -f [service]"
echo "Stop services: docker-compose down"
echo "Restart service: docker-compose restart [service]"
echo "Shell access: docker-compose exec [service] sh"
