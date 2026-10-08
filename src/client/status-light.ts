/**
 * dsh-web-brand — browser "no custom icon" status light.
 *
 * When no custom icon is configured the browser-tab favicon becomes a status
 * light, following the idea of dsh-done-whale (MIT): the official whale glyph
 * turns green when a session finished unread and amber when a session is
 * waiting for your interaction. When a custom icon IS configured the host
 * never enables this module, so the custom icon is left completely alone.
 *
 * Two official client stores supply the facts, exactly as the official
 * workspace rows join them (`@deepseek-ai/dsh-client-ui-workspace`,
 * src/client/tree.ts `sessionNode`):
 *
 *  - `ctx.sessions.list` (@deepseek-ai/dsh-api-session-controller/client)
 *    owns the catalog rows, including the `origin: 'subagent'` mark the
 *    status light filters on;
 *  - `ctx.uiSession.sessionStatus` (@deepseek-ai/dsh-client-ui-session/client)
 *    owns the per-session status facts — `completionUnread` (a stop the main
 *    view has not acknowledged) and `pendingInteraction`.
 *
 * `completionUnread` replaced the older `SessionSummary.completed` +
 * `SessionListState.current` pair that dsh 0.1.x retired: it already covers
 * "finished while the tab was hidden with the session selected", so this
 * module tracks no running edges of its own.
 *
 * Pure decision logic lives in statusOf() and is unit-tested; the DOM mount
 * restores the original favicon on dispose.
 */

import { whaleSvgMarkup } from './whale.ts'

/** Palette of the official sidebar status dots (light & dark themes share it). */
export const STATUS_GREEN = '#22C55E'
export const STATUS_AMBER = '#F59E0B'

/**
 * Interaction kinds the official UI surfaces, and therefore the only ones the
 * favicon treats as "awaits you" (mirror of `visiblePendingKind` in
 * @deepseek-ai/dsh-client-ui-workspace src/client/tree.ts). A kind the UI
 * does not surface must not pin the favicon amber with no way to clear it.
 */
export const VISIBLE_PENDING_KINDS = ['approval', 'plan-review', 'question'] as const

/** Structural mirror of the official `SessionStatus`. */
export interface StatusSessionStatus {
  /** Latest known running state; absent until a baseline or event establishes it. */
  running?: boolean
  /** Highest-precedence domain request awaiting user interaction. */
  pendingInteraction?: { readonly kind: string }
  /** A stop outside the main view the user has not acknowledged yet. */
  completionUnread: boolean
}

/** Structural mirror of the official `SessionStatusSnapshot`. */
export type StatusSnapshot = ReadonlyMap<string, StatusSessionStatus>

/** Structural mirror of the `SessionSummary` fields the status light reads. */
export interface StatusSessionRow {
  /** Coarse durable origin; only `subagent` is ever set. */
  origin?: 'subagent'
}

/** Structural mirror of the `SessionListState` fields the status light reads. */
export interface StatusListState {
  byId: Record<string, StatusSessionRow>
}

/** The observable face both official stores expose. */
export interface StatusStore<Snapshot> {
  getSnapshot(): Snapshot
  subscribe(listener: () => void): () => void
}

/** The favicon state the session facts map to; null = keep the original icon. */
export type StatusLightState = 'green' | 'amber' | null

/**
 * Decide the favicon state from the session catalog and the status map.
 * Subagent rows are ignored, so the light reflects main sessions only. Green
 * wins over amber: an unacknowledged completion is the stronger signal.
 * @param list - the official sessions catalog snapshot.
 * @param statuses - the official `uiSession` status snapshot.
 * @returns the light state, or null to keep the page's own favicon.
 */
export function statusOf(list: StatusListState, statuses: StatusSnapshot): StatusLightState {
  let amber = false
  for (const [id, row] of Object.entries(list.byId)) {
    if (row.origin === 'subagent') continue
    const status = statuses.get(id)
    if (status === undefined) continue
    if (status.completionUnread) return 'green'
    const kind = status.pendingInteraction?.kind
    if (kind !== undefined && VISIBLE_PENDING_KINDS.some(visible => visible === kind)) amber = true
  }
  return amber ? 'amber' : null
}

/** The whale glyph rendered in one colour, as a favicon-ready data: URL. */
export function whaleDataUrl(hex: string): string {
  return `data:image/svg+xml,${encodeURIComponent(whaleSvgMarkup(hex))}`
}

/**
 * Every favicon link the page carries. The stock page ships two theme-scoped
 * variants (dark and light), and the browser paints whichever matches the
 * current theme, so recolouring only the first would leave the stock whale in
 * the other theme.
 */
function iconLinks(): HTMLLinkElement[] {
  return [...document.head.querySelectorAll('link[rel~="icon"]')]
    .filter((element): element is HTMLLinkElement => element instanceof HTMLLinkElement)
}

/**
 * Mount the status light over the two live official stores. Returns a
 * disposer that unsubscribes and restores the favicon the page had when this
 * mounted.
 * @param list - official sessions catalog store.
 * @param statuses - official `uiSession` status store.
 * @returns the disposer restoring the original favicon.
 */
export function mountStatusLight(
  list: StatusStore<StatusListState>,
  statuses: StatusStore<StatusSnapshot>,
): () => void {
  /** The href each link had when this mounted, so restore is exact. */
  const originals = iconLinks().map(link => [link, link.href] as const)
  /** The href we set last; null = original icon is in place. */
  let applied: string | null = null

  const setHref = (href: string): void => {
    for (const link of iconLinks()) link.href = href
  }
  const restore = (): void => {
    if (applied === null) return
    for (const [link, href] of originals) link.href = href
    applied = null
  }

  /** Green/amber decision; null = original icon. */
  function sync(): void {
    try {
      const state = statusOf(list.getSnapshot(), statuses.getSnapshot())
      if (state === null) {
        restore()
        return
      }
      const next = whaleDataUrl(state === 'green' ? STATUS_GREEN : STATUS_AMBER)
      if (applied !== next) {
        setHref(next)
        applied = next
      }
    } catch {
      // Never let a status hiccup break the page.
    }
  }

  const unsubscribeList = list.subscribe(sync)
  const unsubscribeStatus = statuses.subscribe(sync)
  sync()

  return () => {
    unsubscribeList()
    unsubscribeStatus()
    restore()
  }
}
