/**
 * dsh-web-brand — host half (the `web-brand` row, see cordis.patch.yml).
 *
 * Merges the brand values from three channels with flag > env > row-config
 * precedence, then:
 *  1. rewrites the served index.html per request (<title> gets the brand
 *     prefix, <link rel="icon"> points at the branded favicon) so the very
 *     first paint — before any JavaScript runs — is already branded;
 *  2. publishes globalThis.__DSH_WEB_BRAND__ through an index-injection
 *     `global` row, the host→browser value channel the client half reads;
 *  3. serves a local icon file (svg/png/ico/jpg/webp/gif/avif) at
 *     /dsh-web-brand/icon behind the same browser-trust fence every other
 *     dsh route applies.
 *
 * Favicon policy: when an icon is configured (any channel) it is served and
 * linked as-is; when it is not, the browser client turns the stock whale
 * favicon into a status light (green = a session finished, amber = something
 * awaits you) unless the row config sets `statusLight: false`. The row is a
 * full no-op only when no title, no icon and no status light remain.
 * @module dsh-web-brand
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import {
  brandIndexHtml, dataUrlType, DEFAULT_SEPARATOR, isRemoteIcon, mimeOfIconFile,
  shortHash, type IndexBrandTap,
} from './branding.ts'
import { isTrustedRequest } from './fence.ts'
import type {
  BrandHostContext, BrandHttpRequest, BrandHttpResponse, WebBrandConfig,
} from './types.ts'

/** Stable Cordis plugin name. */
export const name = 'web-brand'

/** Services required before the branding values can be merged: the parsed
 *  web flags (webStartup, provided by the plugin's own startup row), the
 *  webserver (tap + route + index-inject), and the runtime trust list
 *  (the icon route's fence authority source). */
export const inject = ['webServer', 'webStartup', 'webRuntime']

/** Environment fallbacks (channel 2 of flag > env > row config). */
export const TITLE_ENV = 'DSH_WEB_BRAND_TITLE' as const
export const ICON_ENV = 'DSH_WEB_BRAND_ICON' as const

/** Favicon route prefix; the tap points the page's icon link at it. */
export const ICON_ROUTE = '/dsh-web-brand/icon' as const

/** The browser value channel's global name (client half reads it). */
export const BRAND_GLOBAL = '__DSH_WEB_BRAND__' as const

/** A local icon resolved and read at activation. */
interface ServedIcon {
  bytes: Buffer
  mime: string
  /** Content-hash cache-buster in the link href. */
  rev: string
}

/** Trim and drop blank strings at each channel, so a blank lower channel
 *  can never shadow a configured higher one. */
function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

/**
 * Merge the three value channels. Flag (parsed webStartup) wins over the
 * environment variable, which wins over the row config written by the
 * profile's cordis.patch.yml. A blank value at any channel counts as unset.
 * @param flag - values from the command line (webStartup.title/icon).
 * @param config - the row's own config.
 * @returns the effective title and icon value, trimmed.
 */
export function mergeBrand(
  flag: { title?: string; icon?: string } | undefined,
  config: WebBrandConfig | undefined,
  environment: NodeJS.ProcessEnv = process.env,
): { title?: string; icon?: string } {
  const title = normalize(flag?.title) ?? normalize(environment[TITLE_ENV]) ?? normalize(config?.title)
  const icon = normalize(flag?.icon) ?? normalize(environment[ICON_ENV]) ?? normalize(config?.icon)
  return {
    ...title !== undefined ? { title } : {},
    ...icon !== undefined ? { icon } : {},
  }
}

/**
 * Resolve an icon value into what the page link will carry.
 * @param value - a local path or an http(s):/data: URL.
 * @param cwd - directory relative local paths resolve against (process.cwd()).
 * @returns the href + optional MIME, or a ServedIcon when a local file was read.
 * @throws when a local file is missing or its extension is not a recognized
 * favicon format — the branding row then fails the boot loudly, like the
 * official web startup rejects a non-numeric --port.
 */
export function resolveIcon(value: string, cwd: string): { href: string; type?: string; served?: ServedIcon } {
  if (isRemoteIcon(value)) {
    return { href: value, type: dataUrlType(value) }
  }
  const path = resolve(cwd, value)
  const mime = mimeOfIconFile(path)
  if (mime === undefined) {
    throw new Error(`dsh-web-brand: --icon ${JSON.stringify(value)} has an unrecognized format; `
      + 'supported: svg, png, ico, jpg, jpeg, webp, gif, avif, or an http(s):/data: URL')
  }
  let bytes: Buffer
  try {
    bytes = readFileSync(path)
  } catch (error) {
    throw new Error(`dsh-web-brand: --icon file not readable at ${path}: ${String(error)}`, { cause: error })
  }
  const served: ServedIcon = { bytes, mime, rev: shortHash(bytes) }
  return { href: `${ICON_ROUTE}?rev=${served.rev}`, type: mime, served }
}

/** The exact icon route handler (mirror of the plugin route style). */
export function createIconHandler(served: ServedIcon, trustedHosts: readonly string[]) {
  return (request: BrandHttpRequest, response: BrandHttpResponse): void => {
    if (!isTrustedRequest(request, trustedHosts)) {
      response.writeHead(403)
      response.end('forbidden')
      return
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405)
      response.end()
      return
    }
    response.writeHead(200, {
      'content-type': served.mime,
      // The href carries the content-hash rev, so the bytes are immutable.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    })
    if (request.method === 'HEAD') response.end()
    else response.end(served.bytes)
  }
}

/**
 * Branding row body.
 * @param ctx - plugin context carrying webServer/webStartup/webRuntime.
 * @param config - the row's own config (profile cordis.patch.yml writes it).
 */
export function apply(ctx: Context, config?: WebBrandConfig): void {
  const host = ctx as unknown as BrandHostContext
  const brand = mergeBrand(host.webStartup, config)
  // Status light (official whale recoloured by session state) defaults on
  // whenever no custom icon is configured; the row config can turn it off.
  const statusLight = config?.statusLight ?? brand.icon === undefined
  if (brand.title === undefined && brand.icon === undefined && !statusLight) return

  const tap: IndexBrandTap = { title: brand.title }
  let servedIcon: ServedIcon | undefined
  if (brand.icon !== undefined) {
    const icon = resolveIcon(brand.icon, process.cwd())
    tap.iconHref = icon.href
    tap.iconType = icon.type
    servedIcon = icon.served
  }

  ctx.effect(() => {
    const disposers: (() => void)[] = []
    // Per-request index rewrite: the very first response is already branded.
    // Only the HTML fields the user configured are rewritten — with no icon
    // the stock favicon stays untouched server-side and the client status
    // light recolours it at runtime.
    if (tap.title !== undefined || tap.iconHref !== undefined) {
      const untap = host.webServer.tapIndex(html => brandIndexHtml(html, tap))
      disposers.push(untap)
    }
    // Host → browser value channel. Pushed on every collectIndexInjections
    // emit (each index render), against a fresh table — same pattern as
    // @deepseek-ai/dsh-client-modules. The client needs the row when there is
    // a title to prefix or a status light to run.
    if (tap.title !== undefined || statusLight) {
      const unsubscribe = host.on('webserver/index-inject', (table) => {
        table.push({
          kind: 'global',
          name: BRAND_GLOBAL,
          value: {
            ...brand.title !== undefined ? { title: brand.title } : {},
            sep: DEFAULT_SEPARATOR,
            customIcon: brand.icon !== undefined,
            statusLight,
          },
        })
      })
      if (typeof unsubscribe === 'function') disposers.push(unsubscribe)
    }
    // Local icon bytes: route + immutable caching keyed by the hash rev.
    if (servedIcon !== undefined) {
      disposers.push(host.webServer.register({
        kind: 'exact',
        path: ICON_ROUTE,
        handler: createIconHandler(servedIcon, host.webRuntime.trustedHosts),
      }))
    }
    return () => { for (const dispose of disposers) dispose() }
  }, 'dsh-web-brand: index title/icon rewrite + brand global + status light gate')
}
