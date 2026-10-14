/// <reference types="vitest/config" />
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Copies the static module files (manifest, language files, assets) into dist/. */
function copyStatic(): Plugin {
    const entries = ['module.json', 'lang', 'assets', 'LICENSE', 'README.md'];
    return {
        name: 'sci-copy-static',
        closeBundle() {
            const out = resolve(__dirname, 'dist');
            if (!existsSync(out)) mkdirSync(out, { recursive: true });
            for (const entry of entries) {
                const src = resolve(__dirname, entry);
                if (existsSync(src)) cpSync(src, resolve(out, entry), { recursive: true });
            }
        },
    };
}

export default defineConfig(({ mode }) => ({
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: mode === 'development',
        minify: mode !== 'development',
        lib: {
            entry: resolve(__dirname, 'src/main.ts'),
            formats: ['es'],
            fileName: () => 'main.js',
            cssFileName: 'style',
        },
    },
    plugins: [copyStatic()],
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
    },
}));
