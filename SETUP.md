# Local Development Setup

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres and Redis)
- pnpm (or use `npx pnpm`)

## Quick Start

1. **Start Docker Desktop** (if not already running)

2. **Start infrastructure services:**
   ```bash
   docker-compose up -d
   ```

3. **Install dependencies:**
   ```bash
   npx pnpm install
   ```

4. **Build the tracker script:**
   ```bash
   cd apps/script && npx pnpm build && cd ../..
   ```

5. **Run database migrations:**
   ```bash
   npx pnpm migrate
   ```
   
   Note: If migrations fail, you may need to run the SQL manually from `packages/db/src/migrations/0000_initial.sql`

6. **Start all services:**
   ```bash
   npx pnpm dev
   ```

   This will start:
   - Collector on http://localhost:3001
   - Web dashboard on http://localhost:3000

## Manual Setup (without Docker)

If you prefer to run Postgres and Redis manually:

1. **Install Postgres 16** and create database:
   ```bash
   createdb analytics
   ```

2. **Install Redis 7** and start it:
   ```bash
   redis-server
   ```

3. **Set environment variables:**
   ```bash
   export DATABASE_URL=postgresql://youruser@localhost:5432/analytics
   export REDIS_URL=redis://localhost:6379
   ```

4. **Run migrations:**
   ```bash
   npx pnpm migrate
   ```

5. **Start services:**
   ```bash
   npx pnpm dev
   ```

## First Time Setup

1. Open http://localhost:3000
2. Click "Create account"
3. Register with email and password
4. Create your first site
5. Copy the installation snippet
6. Install on your website or test locally

## Troubleshooting

### Docker not running
- Start Docker Desktop
- Wait for it to fully start
- Try `docker-compose up -d` again

### Database connection errors
- Check Postgres is running: `docker ps`
- Verify connection string in `.env` file
- Check logs: `docker-compose logs postgres`

### Port already in use
- Change ports in `docker-compose.yml` or `.env`
- Or stop the service using the port

### Migration errors
- Run the SQL manually from `packages/db/src/migrations/0000_initial.sql`
- Or drop and recreate the database

## Development Commands

- `npx pnpm dev` - Start all services in dev mode
- `npx pnpm build` - Build all packages
- `npx pnpm lint` - Run linting
- `npx pnpm typecheck` - Type check all packages
- `npx pnpm test` - Run tests
- `npx pnpm size` - Check tracker script size

## Services

- **Web Dashboard**: http://localhost:3000
- **Collector API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Tracker Script**: http://localhost:3001/analytics.js


