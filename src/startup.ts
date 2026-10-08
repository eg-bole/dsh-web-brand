/**
 * dsh-web-brand/startup — the web app's command-line provider, superset of
 * the official @deepseek-ai/dsh-web-app/startup it replaces (see
 * cordis.patch.yml for why the official row is disabled): it parses the
 * same `dsh --profile web` flag family (`--host`, `--port`, `--public-url`,
 * `--trusted-host`, `--no-open`), plus the dsh-web-brand extension
 * (`--title`, `--icon`), then provides the immutable values as the
 * `webStartup` service — the exact service the official provider publishes,
 * so the webserver / web-runtime rows are unaffected. Its `--help` text is
 * the one `dsh web --help` now prints.
 *
 * Version caveat: this commander program mirrors the official web flag set
 * of dsh 0.2.x, which added `--public-url`; when upstream adds flags, mirror
 * them here.
 * @module dsh-web-brand/startup
 */

import { Command } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { parseCmdline } from '@deepseek-ai/dsh-cmdline'
import { parsePublicUrl } from './public-url.ts'
import type { WebStartupValues } from './types.ts'

/** Stable Cordis plugin name. */
export const name = 'web-brand-startup'

/** Services required before the flags can be resolved. */
export const inject = ['cmdlineArgs']

/** Service provided by this ordinary plugin and injected by flag-configured rows. */
export const WEB_STARTUP_SERVICE = 'webStartup'

/** The web flag family, as commander parsed it. */
interface WebOptions {
  host?: string
  icon?: string
  open: boolean
  port?: string
  publicUrl?: string
  title?: string
  trustedHost?: string[]
}

/**
 * This app's command: its flags, its description, and its help text.
 * @returns a fresh program, so one process can parse more than once (tests).
 */
function webCommand(): Command {
  return new Command()
    .name('dsh --profile web')
    .description('Serve the DeepSeek Harness browser UI.')
    .helpOption('-h, --help', 'show this help')
    .option('--host <host>', 'bind host')
    .option('--no-open', 'do not open the Web UI in the default browser')
    .option('--port <port>', 'listen port; pass 0 to let the OS pick a free one')
    .option('--public-url <url>', 'advertise this HTTP(S) root in the printed, opened, web-surface, and DSH_WEB_URL forms; grants no trust')
    .option('--trusted-host <authority...>', 'extra authority the /api browser-trust fence accepts (host or host:port; repeatable)')
    // dsh-web-brand extension. The icon value is validated (existence /
    // format) by the branding row at activation, so a bad --icon fails the
    // boot there with the same loudness as a bad --port fails here.
    .option('--title <text>', 'brand every browser tab with this prefix (dsh-web-brand)')
    .option('--icon <path-or-url>', 'favicon: local file (svg/png/ico/jpg/webp/gif/avif) or an http(s):/data: URL (dsh-web-brand)')
    .addHelpText('after', `
Examples:
  dsh --profile web                          serve on the composed host and port
  dsh --profile web --no-open                serve without opening a browser
  dsh --profile web --port 8080              serve on another port
  dsh --profile web --public-url https://app.example/ui/ --trusted-host app.example
                                             advertise a prefix-stripping HTTPS proxy entry and admit its authority
  dsh --profile web --title prod --icon ./brand.png
                                             brand tabs and favicon (dsh-web-brand)
`)
}

/**
 * Parse and provide the Web invocation as an ordinary Cordis service. The
 * command's action publishes the flags this invocation named; `--host 0.0.0.0`,
 * a non-numeric `--port`, or a malformed `--public-url` is a usage error, so on
 * rejection (and on `--help`) nothing is provided.
 * @param ctx - plugin context carrying the command line.
 */
export function apply(ctx: Context): void {
  const program = webCommand()
  program.action(() => {
    const options = program.opts<WebOptions>()
    if (options.host === '0.0.0.0') {
      program.error('error: --host 0.0.0.0 is intentionally not supported yet for safety: it would expose remote code execution to the network; use 127.0.0.1 instead')
    }
    if (options.port !== undefined && !/^\d+$/.test(options.port)) {
      program.error(`error: --port must be a number, got ${JSON.stringify(options.port)}`)
    }
    if (options.publicUrl !== undefined) {
      try {
        parsePublicUrl(options.publicUrl, '--public-url')
      } catch (error) {
        program.error(`error: ${(error as Error).message}`)
      }
    }
    ctx.provide(WEB_STARTUP_SERVICE, {
      openBrowser: options.open,
      ...options.host !== undefined && { host: options.host },
      ...options.port !== undefined && { port: Number(options.port) },
      ...options.publicUrl !== undefined && { publicUrl: options.publicUrl },
      trustedHosts: options.trustedHost ?? [],
      ...options.title !== undefined && options.title.trim() !== '' ? { title: options.title.trim() } : {},
      ...options.icon !== undefined && options.icon.trim() !== '' ? { icon: options.icon.trim() } : {},
    } satisfies WebStartupValues)
  })
  parseCmdline(ctx, program)
}
