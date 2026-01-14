import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ingestionHandler } from './ingestion.js';
import { realtimeHandler } from './realtime.js';
import { verifyHandler } from './verify.js';
import { serveScript } from './script-server.js';
import { versionHandler } from './version.js';
import { importHandler } from './import.js';
import { getDb } from '@analytics/db';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runCorrelationsJob } from './jobs/correlations.js';
import { runDeltaJob } from './jobs/delta.js';
import { runProblemsJob } from './jobs/problems.js';
import { runRetentionJob } from './jobs/retention.js';

dotenv.config();

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  requestIdLogLabel: 'reqId',
  genReqId: () => crypto.randomUUID(),
});

async function setup() {
  // CORS - allow all origins (script may be loaded anywhere)
  // Note: sendBeacon always includes credentials, so we must allow them
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-site-id', 'x-site-key'],
    credentials: true, // Required because sendBeacon always sends credentials
    preflight: true, // Enable preflight handling
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100, // per IP
    timeWindow: '1 minute',
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });
}

// Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Health check
app.get('/health', async () => {
  const version = readVersion();
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version,
    services: {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
    },
  };

  // Check database
  try {
    const db = getDb();
    // Test with a simple query
    await db.execute(sql`SELECT 1`);
    health.services.database = { status: 'connected' };
  } catch (error: any) {
    health.services.database = { status: 'disconnected', error: error.message };
    health.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = { status: 'connected' };
  } catch (error: any) {
    health.services.redis = { status: 'disconnected', error: error.message };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return health;
});

// Version endpoint
app.get('/api/version', versionHandler);

// Ingestion endpoint
app.post('/e', async (request, reply) => {
  return ingestionHandler(request, reply, redis);
});

// Data import endpoint
app.post('/import', async (request, reply) => {
  return importHandler(request, reply);
});

// Realtime stream
app.get<{ Params: { public_site_id: string } }>('/stream/:public_site_id', async (request, reply) => {
  return realtimeHandler(request, reply, redis);
});

// Verify endpoint
app.get<{ Params: { public_site_id: string } }>('/verify/:public_site_id', async (request, reply) => {
  return verifyHandler(request, reply);
});

// Serve tracker script
app.get('/analytics.js', serveScript);

// Start server
const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    await setup();

    // Test database connection
    const db = getDb();
    // Simple connection test - drizzle doesn't have execute, so we'll just check if db exists
    // The connection will be tested on first query

    // Test Redis connection
    await redis.ping();

    await app.listen({ port, host });
    console.log(`Collector server listening on ${host}:${port}`);

    // Start background jobs
    startBackgroundJobs();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

function startBackgroundJobs() {
  // Correlations: hourly
  setInterval(() => {
    runCorrelationsJob().catch(err => {
      console.error('[Background Jobs] Correlations job failed:', err);
    });
  }, 60 * 60 * 1000); // 1 hour

  // Run immediately on startup
  runCorrelationsJob().catch(err => {
    console.error('[Background Jobs] Initial correlations job failed:', err);
  });

  // Delta: every 15 minutes
  setInterval(() => {
    runDeltaJob().catch(err => {
      console.error('[Background Jobs] Delta job failed:', err);
    });
  }, 15 * 60 * 1000); // 15 minutes

  // Run immediately on startup
  runDeltaJob().catch(err => {
    console.error('[Background Jobs] Initial delta job failed:', err);
  });

  // Problems: every 5 minutes
  setInterval(() => {
    runProblemsJob().catch(err => {
      console.error('[Background Jobs] Problems job failed:', err);
    });
  }, 5 * 60 * 1000); // 5 minutes

  // Run immediately on startup (after a delay to let deltas compute)
  setTimeout(() => {
    runProblemsJob().catch(err => {
      console.error('[Background Jobs] Initial problems job failed:', err);
    });
  }, 2 * 60 * 1000); // 2 minutes delay

  // Retention: daily
  setInterval(() => {
    runRetentionJob().catch(err => {
      console.error('[Background Jobs] Retention job failed:', err);
    });
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Run immediately on startup
  runRetentionJob().catch(err => {
    console.error('[Background Jobs] Initial retention job failed:', err);
  });

  console.log('[Background Jobs] Started all background jobs');
}

function readVersion(): string {
  try {
    const versionPath = join(process.cwd(), '..', '..', 'VERSION');
    return readFileSync(versionPath, 'utf-8').trim();
  } catch {
    return '1.0.0';
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.close();
  await redis.quit();
  process.exit(0);
});

start();

