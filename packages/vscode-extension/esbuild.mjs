// esbuild script for the extension host (Node.js / CommonJS)
import * as esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[esbuild] watching extension...');
} else {
  await esbuild.build(options);
  console.log('[esbuild] extension built.');
}
