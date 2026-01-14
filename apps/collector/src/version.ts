import { FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function versionHandler(request: FastifyRequest, reply: FastifyReply) {
  const currentVersion = readVersion();
  
  // Optionally check for latest version (if not disabled)
  if (process.env.DISABLE_UPDATE_CHECK !== 'true') {
    try {
      // In a real implementation, you might fetch from GitHub releases API
      // For MVP, just return current version
      const latest = currentVersion; // TODO: fetch from GitHub API
      
      return {
        version: currentVersion,
        latest,
        updateAvailable: false, // TODO: compare versions
        changelogUrl: `https://github.com/yourorg/analytics/releases/tag/v${latest}`,
      };
    } catch (error) {
      // If update check fails, just return current version
    }
  }

  return {
    version: currentVersion,
  };
}

function readVersion(): string {
  try {
    const versionPath = join(process.cwd(), '..', '..', 'VERSION');
    return readFileSync(versionPath, 'utf-8').trim();
  } catch {
    return '1.0.0';
  }
}


