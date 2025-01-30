import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/lib/langchain/embeddings/generate.ts'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  outfile: 'dist/generate.js',
  format: 'esm',
}).catch(() => process.exit(1)); 