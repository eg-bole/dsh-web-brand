/**
 * dsh-web-brand — client half (browser).
 *
 * Reads globalThis.__DSH_WEB_BRAND__ (an index-injection `global` row the
 * host pushes into every served page, so it exists before any script runs),
 * then watches document.title and keeps the brand prefix in front of
 * whatever the dsh shell writes: the product title while no session is
 * selected, and "<session> — <product>" once a session is. Pure DOM work,
 * no framework knowledge — the shell's React DocumentTitle component keeps
 * doing its thing underneath, and this overlay only prefixes.
 *
 * The observer writes only when the title does not already carry the prefix
 * (see brandedTitle), so its own writes never re-trigger it. Everything is
 * restored on fiber dispose.
 */
import type { Context } from '@deepseek-ai/cordis'
import { brandedTitle, DEFAULT_SEPARATOR } from './title.ts'

/** The global the host publishes (shape mirror of the host's global row). */
interface WebBrandGlobal {
  /** Brand prefix; absent/empty means the host configured no title. */
  title?: string
  /** Separator between brand and original title (host-owned default ' - '). */
  sep?: string
}

/** The global name the host's index-injection row sets (keep in sync with
 *  the host's BRAND_GLOBAL). */
const BRAND_GLOBAL = '__DSH_WEB_BRAND__'

/** Read the brand the host configured for this page. */
function readBrand(): WebBrandGlobal | undefined {
  return (globalThis as { [BRAND_GLOBAL]?: WebBrandGlobal })[BRAND_GLOBAL]
}

/** Stable Cordis plugin name (registration id is the package name). */
export function apply(ctx: Context): void {
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
}
