#!/bin/bash

# SSL Setup Script for No Name Analytics
# This script sets up Let's Encrypt SSL certificates

set -e

DOMAIN="${1:-noname.fyi}"
EMAIL="${2:-admin@noname.fyi}"

echo "=========================================="
echo "SSL Setup for No Name Analytics"
echo "=========================================="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot python3-certbot-nginx
    else
        echo "Unsupported OS. Please install certbot manually."
        exit 1
    fi
fi

# Create directory for certbot challenges
mkdir -p /var/www/certbot

# Stop nginx temporarily for initial certificate generation
echo "Stopping nginx..."
docker compose -f /opt/analytics/docker-compose.prod.yml stop nginx || true

# Generate certificate using standalone mode
echo "Generating SSL certificate..."
certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --preferred-challenges http

# Copy SSL nginx configuration
echo "Copying SSL nginx configuration..."
cp /opt/analytics/nginx-ssl.conf /opt/analytics/nginx.conf

# Restart nginx
echo "Starting nginx..."
docker compose -f /opt/analytics/docker-compose.prod.yml up -d nginx

# Set up automatic renewal
echo "Setting up automatic certificate renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f /opt/analytics/docker-compose.prod.yml restart nginx'") | crontab -

echo ""
echo "=========================================="
echo "SSL Setup Complete!"
echo "=========================================="
echo "Your site is now available at: https://$DOMAIN"
echo ""
echo "Certificate will auto-renew via cron job."
echo "To test renewal: certbot renew --dry-run"
echo ""

