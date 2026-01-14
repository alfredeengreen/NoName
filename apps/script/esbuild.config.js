const esbuild = require('esbuild');
const { readFileSync } = require('fs');
const { join } = require('path');

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  target: 'es2018',
  format: 'iife',
  outfile: 'dist/analytics.js',
  // Remove globalName - we set window.aa manually in the code
  // This prevents esbuild from wrapping in var aa=(()=>{...})()
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  banner: {
    js: '/* Analytics Tracker - Privacy First */\n(function(){if(typeof window!="undefined"){window.aa=window.aa||function(){window.aa.q=window.aa.q||[];window.aa.q.push(arguments)}}})();',
  },
};

if (isWatch) {
  esbuild
    .context(config)
    .then((ctx) => {
      ctx.watch();
      console.log('Watching for changes...');
    })
    .catch(() => process.exit(1));
} else {
  esbuild
    .build(config)
    .then(() => {
      console.log('Build complete');
    })
    .catch(() => process.exit(1));
}

