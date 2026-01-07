function detectFramework() {
  if (fs.existsSync('astro.config.mjs')) return 'astro';
  if (pkg.dependencies?.react) return 'react';
}