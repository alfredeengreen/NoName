# Deployment Guide

This repository contains a production-ready analytics platform. To deploy:

## Prerequisites

- Docker and Docker Compose installed on the server
- SSH access to the deployment server
- PostgreSQL and Redis (or use Docker Compose)

## Deployment Steps

1. **Set up environment variables:**
   ```bash
   export DEPLOY_SERVER=user@hostname
   export DEPLOY_SSH_PASSWORD=your_password
   export DEPLOY_PATH=/opt/analytics
   ```

2. **Use the example deployment script:**
   ```bash
   cp deploy-production.sh.example deploy-production.sh
   # Edit deploy-production.sh and set your credentials
   # DO NOT commit deploy-production.sh to git
   chmod +x deploy-production.sh
   ./deploy-production.sh
   ```

3. **Manual deployment:**
   - Copy code to server
   - Run database migrations
   - Build and start Docker containers

## Security Notes

- Never commit deployment scripts with hardcoded credentials
- Use environment variables for sensitive information
- Keep deployment scripts in `.gitignore`
- Rotate credentials regularly

## Database Migrations

Migrations are located in `packages/db/src/migrations/` and are automatically applied during deployment.

## Troubleshooting

See `SETUP.md` for local development setup and troubleshooting tips.
