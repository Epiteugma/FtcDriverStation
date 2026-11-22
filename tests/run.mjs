// Bundles tests/*.test.ts with esbuild (Svelte runes in *.svelte.ts are compiled) and runs them with node:test.
import { build } from 'esbuild';
import sveltePlugin from 'esbuild-svelte';
import { readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dir = 'build-tests';
rmSync(dir, { recursive: true, force: true });

const entryPoints = readdirSync('tests').filter(f => f.endsWith('.test.ts')).map(f => 'tests/' + f);

await build({
    entryPoints,
    plugins: [sveltePlugin({ compilerOptions: { css: 'injected' } })],
    bundle: true,
    format: 'esm',
    platform: 'node',
    conditions: ['browser'],
    outdir: dir,
    outExtension: { '.js': '.mjs' },
    logLevel: 'warning',
});

const result = spawnSync(process.execPath, ['--test', ...entryPoints.map(f => f.replace('tests/', dir + '/').replace(/\.ts$/, '.mjs'))], { stdio: 'inherit' });
process.exit(result.status ?? 1);
