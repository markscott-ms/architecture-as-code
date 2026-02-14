import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    sourcemap: false,
    clean: true,
    external: ['canvas', 'fsevents', '@apidevtools/json-schema-ref-parser', 'ts-node'],
    noExternal: ['@finos/calm-shared'],
    bundle: true,
    splitting: false,
    minify: false,
    shims: true,
    target: 'es2021',
    treeshake: true
});
