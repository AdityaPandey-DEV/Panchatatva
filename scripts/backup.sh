#!/bin/bash

# Panchtatva Justice Automation - Backup Script
# Usage: ./scripts/backup.sh

set -e

BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="panchtatva_backup_$DATE"

echo "🗄️  Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "📊 Backing up database..."
if docker-compose ps | grep -q panchtatva-db; then
    docker-compose exec -T mongodb mongodump --uri="mongodb://admin:panchtatva2024@localhost:27017/panchtatva-justice?authSource=admin" --out=/tmp/backup
    docker cp panchtatva-db:/tmp/backup $BACKUP_DIR/${BACKUP_NAME}_database
    echo "✅ Database backup completed"
else
    echo "⚠️  Database container not running, skipping database backup"
fi

# Files backup
echo "📁 Backing up files..."
tar -czf $BACKUP_DIR/${BACKUP_NAME}_files.tar.gz \
    backend/logs \
    backend/uploads \
    .env \
    2>/dev/null || echo "⚠️  Some files may not exist yet"

echo "✅ Files backup completed"

# Configuration backup
echo "⚙️  Backing up configuration..."
cp docker-compose.yml $BACKUP_DIR/${BACKUP_NAME}_docker-compose.yml
cp env.example $BACKUP_DIR/${BACKUP_NAME}_env.example

echo "🎉 Backup completed successfully!"
echo "📍 Backup location: $BACKUP_DIR/"
echo "📦 Files created:"
ls -la $BACKUP_DIR/${BACKUP_NAME}*
