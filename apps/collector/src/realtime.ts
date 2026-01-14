import { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';

export async function realtimeHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  redis: Redis
) {
  const { public_site_id } = (request.params as { public_site_id: string });

  // TODO: Add authentication (dashboard session token or admin key)
  // For MVP, we'll skip auth on realtime endpoint

  // Set SSE headers
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  const key = `live:${public_site_id}`;
  const channel = `livepub:${public_site_id}`;

  // Send last 50 events on connect
  try {
    const recentEvents = await redis.lrange(key, 0, 49);
    for (const eventStr of recentEvents.reverse()) {
      reply.raw.write(`data: ${eventStr}\n\n`);
    }
  } catch (error) {
    console.error('Error reading recent events:', error);
  }

  // Subscribe to pubsub
  const subscriber = redis.duplicate();
  await subscriber.subscribe(channel);

  subscriber.on('message', (ch, message) => {
    if (ch === channel) {
      try {
        reply.raw.write(`data: ${message}\n\n`);
      } catch (error) {
        // Client disconnected
        subscriber.unsubscribe(channel);
        subscriber.quit();
      }
    }
  });

  // Handle client disconnect
  request.raw.on('close', () => {
    subscriber.unsubscribe(channel);
    subscriber.quit();
  });

  // Keep connection alive
  const keepAlive = setInterval(() => {
    try {
      reply.raw.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      subscriber.unsubscribe(channel);
      subscriber.quit();
    }
  }, 30000);

  request.raw.on('close', () => {
    clearInterval(keepAlive);
  });
}

