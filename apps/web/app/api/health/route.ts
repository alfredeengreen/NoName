import { NextResponse } from 'next/server';
import { getPool } from '@analytics/db';
import Redis from 'ioredis';

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    return redisClient;
  } catch {
    return null;
  }
}

export async function GET() {
  const health = {
    status: 'ok' as 'ok' | 'degraded' | 'error',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: {
        status: 'unknown' as 'connected' | 'disconnected' | 'unknown',
        responseTime: null as number | null,
        version: null as string | null,
      },
      redis: {
        status: 'unknown' as 'connected' | 'disconnected' | 'unknown',
        responseTime: null as number | null,
      },
    },
  };

  let hasError = false;
  let hasDegraded = false;

  // Check database
  try {
    const pool = getPool();
    const dbStart = Date.now();
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    const dbTime = Date.now() - dbStart;

    health.services.database = {
      status: 'connected',
      responseTime: dbTime,
      version: result.rows[0]?.pg_version?.split(' ')[0] + ' ' + result.rows[0]?.pg_version?.split(' ')[1],
    };
  } catch (error: any) {
    health.services.database = {
      status: 'disconnected',
      responseTime: null,
      version: null,
    };
    hasError = true;
  }

  // Check Redis
  try {
    const redis = getRedisClient();
    if (redis) {
      const redisStart = Date.now();
      await redis.ping();
      const redisTime = Date.now() - redisStart;

      health.services.redis = {
        status: 'connected',
        responseTime: redisTime,
      };
    } else {
      health.services.redis = {
        status: 'disconnected',
        responseTime: null,
      };
      hasDegraded = true;
    }
  } catch (error: any) {
    health.services.redis = {
      status: 'disconnected',
      responseTime: null,
    };
    hasDegraded = true;
  }

  // Determine overall status
  if (hasError) {
    health.status = 'error';
  } else if (hasDegraded) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'error' ? 503 : health.status === 'degraded' ? 200 : 200;

  return NextResponse.json(health, { status: statusCode });
}

