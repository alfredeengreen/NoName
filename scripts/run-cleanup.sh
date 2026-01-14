#!/bin/bash
# Cleanup script for production - removes old events and expired sessions
# Run daily via cron: 0 3 * * * /path/to/scripts/run-cleanup.sh

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database URL is required
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

# Run cleanup using Node.js
cd "$(dirname "$0")/.."
node -e "
const { runAllCleanup } = require('./packages/db/dist/cleanup');
const { runSessionCleanup } = require('./packages/db/dist/cleanup-sessions');

async function main() {
  try {
    console.log('Starting cleanup...');
    
    // Run both cleanups
    const results = await Promise.all([
      runAllCleanup(),
      runSessionCleanup()
    ]);
    
    console.log('Cleanup completed successfully');
    console.log('Events:', results[0]);
    console.log('Sessions:', results[1]);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

main();
"


