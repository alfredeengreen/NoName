import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  try {
    const versionPath = join(process.cwd(), '..', '..', 'VERSION');
    const version = readFileSync(versionPath, 'utf-8').trim();

    // TODO: Check GitHub releases API for latest version
    const latest = version; // For MVP, just return current version

    return NextResponse.json({
      version,
      latest,
      updateAvailable: false,
      changelogUrl: `https://github.com/yourorg/analytics/releases`,
    });
  } catch (error) {
    return NextResponse.json({
      version: '1.0.0',
    });
  }
}


