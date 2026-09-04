/**
 * tsdown build for dsh-web-brand: the host-half lib (lib/index.js +
 * lib/startup.js, ESM node) plus the browser client bundle (lib/client.js,
 * CJS closure factory registered through window.__ModuleLoader__ with the
 * package-name id — the client-modules compose keys on the package name).
 *
 * The client half is dependency-free at runtime (pure DOM + a one-line
 * read of the global the host injected); cordis types are erased and never
 * reach the bundle. Host peers (@deepseek-ai/cordis, @deepseek-ai/dsh-cmdline)
 * stay external and resolve from the dsh installation at runtime.
 */
import type { UserConfig } from 'tsdown'

export default [
  {
    entry: { index: 'src/index.ts', startup: 'src/startup.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    inputOptions: {
      resolve: {
        conditionNames: ['browser', 'import', 'require', 'default'],
      },
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-web-brand", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      // One script, no splitting.
      codeSplitting: false,
    },
  },
] satisfies UserConfig[]
