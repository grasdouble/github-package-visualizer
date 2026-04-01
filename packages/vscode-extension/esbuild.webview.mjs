// esbuild script for the webview React app (browser / ESM bundled to IIFE)
import * as esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: false,
  jsx: 'automatic',            // utilise react/jsx-runtime — pas besoin de React global
  jsxImportSource: 'react',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: {
    '.json': 'json',
  },
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[esbuild] watching webview...');
} else {
  await esbuild.build(options);
  console.log('[esbuild] webview built.');
}
