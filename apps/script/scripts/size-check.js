const { readFileSync } = require('fs');
const { gzipSync } = require('node:zlib');
const { join } = require('path');

const scriptPath = join(__dirname, '..', 'dist', 'analytics.js');
const maxSize = 10240; // 10KB

try {
  const script = readFileSync(scriptPath);
  const gzipped = gzipSync(script);
  const size = gzipped.length;

  console.log(`Script size: ${size} bytes (${(size / 1024).toFixed(2)} KB)`);

  if (size > maxSize) {
    console.error(`❌ Script exceeds ${maxSize} bytes (${(maxSize / 1024).toFixed(2)} KB)`);
    process.exit(1);
  }

  console.log(`✅ Script size OK (${((maxSize - size) / 1024).toFixed(2)} KB remaining)`);
} catch (error) {
  console.error('Error checking script size:', error);
  process.exit(1);
}

