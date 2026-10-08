/**
 * dsh-web-brand — client half (browser).
 *
 * Reads globalThis.__DSH_WEB_BRAND__ (an index-injection `global` row the
 * host pushes into every served page, so it exists before any script runs).
 * The global carries:
 *   - `title`    → the brand prefix; watch document.title and keep it in
 *     front of whatever the dsh shell writes (product title while no session
 *     is selected, "<session> — <product>" once a session is);
 *   - `customIcon` → the host configured an icon (route/http/data: URL);
 *   - `statusLight` → no custom icon is configured, so the official whale
 *     favicon doubles as a status light (see status-light.ts).
 *
 * The title observer writes only when the title does not already carry the
 * prefix (see brandedTitle), so its own writes never re-trigger it.
 *
 * The status light joins two official client stores — `ctx.sessions`
 * (catalog rows and their `origin`) and `ctx.uiSession` (per-session
 * `completionUnread` / `pendingInteraction`). `uiSession` is an OPTIONAL
 * dependency: a profile that does not compose the session UI still gets the
 * title prefix, and the favicon is simply left alone. Both restore themselves
 * on fiber dispose. Pure DOM work, no framework knowledge.
 */
import type { Context } from '@deepseek-ai/cordis'
import {
  mountStatusLight, type StatusListState, type StatusSnapshot, type StatusStore,
} from './status-light.ts'
import { brandedTitle, DEFAULT_SEPARATOR } from './title.ts'

/** The global the host publishes (shape mirror of the host's global row). */
interface WebBrandGlobal {
  /** Brand prefix; absent/empty means the host configured no title. */
  title?: string
  /** Separator between brand and original title (host-owned default ' - '). */
  sep?: string
  /** The host configured a custom icon (route / http(s): / data: URL). */
  customIcon?: boolean
  /** No custom icon: the official whale favicon acts as a status light. */
  statusLight?: boolean
}

/** Services the browser cordis context may carry (structural mirrors). */
interface ClientRuntimeContext {
  /** Official client-side sessions store (@deepseek-ai/dsh-api-session-controller/client). */
  sessions?: { list?: StatusStore<StatusListState> }
  /** Official session UI status store (@deepseek-ai/dsh-client-ui-session/client). */
  uiSession?: { sessionStatus?: StatusStore<StatusSnapshot> }
}

/** The global name the host's index-injection row sets (keep in sync with
 *  the host's BRAND_GLOBAL). */
const BRAND_GLOBAL = '__DSH_WEB_BRAND__'

/** Read the brand the host configured for this page. */
function readBrand(): WebBrandGlobal | undefined {
  return (globalThis as { [BRAND_GLOBAL]?: WebBrandGlobal })[BRAND_GLOBAL]
}

/** Services this client row consumes (cordis fiber inject). The status
 *  light's second store, `uiSession`, is read optionally — see apply(). */
export const inject = ['sessions'] as const

/** Stable Cordis plugin name (registration id is the package name). */
export function apply(ctx: Context): void {
  // Title prefix: runs whenever a brand title is configured.
  ctx.effect(() => {
    const brand = readBrand()
    const title = brand?.title
    if (title === undefined || title === '') return () => {}
    const sep = brand?.sep ?? DEFAULT_SEPARATOR
    const titleElement = document.querySelector('title')
    if (titleElement === null) return () => {}

    const rewrite = (): void => {
      const next = brandedTitle(document.title, title, sep)
      if (next !== undefined && next !== document.title) document.title = next
    }
    // Rewrites happen before the next paint (MutationObserver microtask),
    // so the branded title never visibly flashes through the raw dsh title.
    const observer = new MutationObserver(rewrite)
    observer.observe(titleElement, { characterData: true, childList: true, subtree: true })
    // The title may already carry a session value on a deep-linked reload;
    // correct it once at activation.
    rewrite()
    return () => observer.disconnect()
  }, 'dsh-web-brand: browser title prefix')

  // Status light: only when the host left the favicon to the stock whale
  // (no custom icon) — with a custom icon configured this is never mounted,
  // so the custom icon is never touched.
  ctx.effect(() => {
    const brand = readBrand()
    if (brand?.statusLight !== true) return () => {}
    if (brand.customIcon === true) return () => {}
    const sessions = (ctx as unknown as ClientRuntimeContext).sessions?.list
    if (sessions === undefined) return () => {}

    // Optional dependency: the callback runs once the session UI row is up,
    // and never runs when a profile does not compose it — the inject itself
    // stays isolated in this child fiber so the title prefix above is
    // unaffected either way.
    const fiber = ctx.inject(['uiSession'], (scope) => {
      const statuses = (scope as unknown as ClientRuntimeContext).uiSession?.sessionStatus
      if (statuses === undefined) return
      scope.effect(() => mountStatusLight(sessions, statuses), 'dsh-web-brand: whale favicon status light')
    })
    return () => { void fiber.dispose() }
  }, 'dsh-web-brand: whale favicon status light gate')
}
