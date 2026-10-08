/**
 * Structural type faces this plugin uses from the host. These are plain
 * interface mirrors of the DSH surfaces the plugin consumes (webServer /
 * webRuntime / webStartup / the request-response faces / the index-inject
 * table), so the plugin does not depend on any @deepseek-ai/* package types
 * at runtime — the host context is cast at the apply boundary, exactly like
 * dsh-better-sidebar-icons does.
 */

/** The `webStartup` service shape this plugin provides (superset of the
 *  official web-startup values; title/icon are the dsh-web-brand extension). */
export interface WebStartupValues {
  /** Whether this invocation opens the default browser after startup. */
  openBrowser: boolean
  /** `--host`, absent when the invocation did not name one. */
  host?: string
  /** `--port`, absent when the invocation did not name one. */
  port?: number
  /**
   * `--public-url`, absent when not specified: the advertised HTTP(S) root a
   * prefix-stripping proxy is reached through. Upstream added the flag after
   * dsh 0.2.0-rc.2; versions without a consumer simply ignore the value.
   */
  publicUrl?: string
  /** Explicit `--trusted-host` authorities, in argument order. */
  trustedHosts: string[]
  /** `--title`, the browser-tab brand prefix (dsh-web-brand extension). */
  title?: string
  /** `--icon`, a local file path or an http(s):/data: URL (dsh-web-brand extension). */
  icon?: string
}

/** The branding row's own config (written by the profile cordis.patch.yml). */
export interface WebBrandConfig {
  /** Brand prefix for the browser tab title. */
  title?: string
  /** Favicon: a local file path or an http(s):/data: URL. */
  icon?: string
  /**
   * Whale status light. Default (absent): enabled when no icon is
   * configured — the official whale favicon then doubles as a status light
   * (green = a session finished, amber = something awaits you). Set `false`
   * to leave the favicon alone even without a custom icon.
   */
  statusLight?: boolean
}

/** The request face route handlers read (structural subset of node's
 *  IncomingMessage). */
export interface BrandHttpRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
}

/** The response face route handlers write to (structural subset of node's
 *  ServerResponse). */
export interface BrandHttpResponse {
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

/** One named webserver route (mirror of the host-webserver WebRoute). */
export interface BrandWebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: BrandHttpRequest, res: BrandHttpResponse) => void | Promise<void>
}

/** The webServer service face this plugin uses. */
export interface BrandWebServer {
  register(route: BrandWebRoute): () => void
  /** Raw index.html transform applied to every served index response. */
  tapIndex(transform: (html: string) => string): () => void
}

/** The web runtime trust list (bind-derived; the same source the /api
 *  gateway fence derives from). */
export interface BrandWebRuntime {
  trustedHosts: readonly string[]
}

/** One structured row this plugin pushes into the index-injection table. */
export interface BrandGlobalRow {
  kind: 'global'
  name: string
  value: unknown
}

/** The index-injection table face the `webserver/index-inject` subscriber
 *  receives (other subscribers push their own row kinds). */
export interface BrandIndexTable {
  push(row: BrandGlobalRow): void
}

/** The host plugin context face (cordis supplies these at runtime; the
 *  application casts its context to this). */
export interface BrandHostContext {
  effect(fn: () => void | (() => void), name?: string): void
  on(event: 'webserver/index-inject', listener: (table: BrandIndexTable) => void): void | (() => void)
  webServer: BrandWebServer
  webRuntime: BrandWebRuntime
  webStartup: WebStartupValues
}
