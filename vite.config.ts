import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export default defineConfig({
  server: { watch: { ignored: ['**/artifacts/**'] }, proxy: { '/api': { target: 'http://127.0.0.1:8080', ws: true } } },
  plugins: [{
    name: 'version-service-worker',
    apply: 'build',
    writeBundle(options, bundle) {
      const assets = Object.keys(bundle).filter(name => name !== 'index.html').map(name => '/' + name);
      const worker = readFileSync('public/sw.js', 'utf8')
        .replace('__BUILD_VERSION__', Date.now().toString(36))
        .replace("  '/',", "  '/',\n" + assets.map(name => `  '${name}',`).join('\n'));
      writeFileSync(resolve(options.dir ?? 'dist', 'sw.js'), worker);
    },
  }],
});
