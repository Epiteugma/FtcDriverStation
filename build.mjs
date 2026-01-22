import { build } from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { sveltePreprocess } from 'svelte-preprocess';

await build({
    entryPoints: ['src/index.ts', 'src/preload.ts'],
    external: ['electron'],
    platform: 'node',
    bundle: true,
    outdir: 'dist'
});

await build({
    entryPoints: ['src/app.ts'],
    plugins: [sveltePlugin({
        preprocess: sveltePreprocess(),
    })],
    loader: {
        '.jpg': 'dataurl',
    },
    bundle: true,
    outdir: 'dist'
});