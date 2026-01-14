import { FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function serveScript(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Try multiple possible paths for the script
    const possiblePaths = [
      join(process.cwd(), '..', 'script', 'dist', 'analytics.js'), // Development
      join(process.cwd(), '..', '..', 'apps', 'script', 'dist', 'analytics.js'), // Docker
      join('/app', 'apps', 'script', 'dist', 'analytics.js'), // Docker absolute
    ];
    
    let script: string | null = null;
    for (const scriptPath of possiblePaths) {
      try {
        script = readFileSync(scriptPath, 'utf-8');
        break;
      } catch (e) {
        // Try next path
      }
    }
    
    if (!script) {
      throw new Error('Script not found in any expected location');
    }

    reply
      .type('application/javascript')
      .header('Cache-Control', 'public, max-age=3600')
      .send(script);
  } catch (error) {
    reply.code(404).send({ error: 'Script not found' });
  }
}

