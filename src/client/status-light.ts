/**
 * dsh-web-brand — browser "no custom icon" status light.
 *
 * When no custom icon is configured the browser-tab favicon becomes a status
 * light, following the idea of dsh-done-whale (MIT): the official whale glyph
 * turns green when a main session finished and amber when a session is
 * waiting for your interaction. When a custom icon IS configured the host
 * never enables this module, so the custom icon is left completely alone.
 *
 * Status source: `ctx.sessions.list` — the official client-side sessions
 * store (provided by @deepseek-ai/dsh-api-session-controller's client half;
 * see the ISessions contract). Rows carry the same facts the official sidebar
 * dots render: `running`, `completed` (finished while not selected), and
 * `pendingInteraction` (a blocking user interaction). Subagent rows are
 * ignored — the status reflects main sessions only.
 *
 * Pure decision logic lives in statusOf() and is unit-tested; the DOM mount
 * mirrors dsh-done-whale's bookkeeping (self-tracked running edges + the
 * "finished while this tab was hidden and the session was selected" gap the
 * host does not report) and restores the original favicon on dispose.
 */

import { whaleSvgMarkup } from './whale.ts'

/** Palette of the official sidebar status dots (light & dark themes share it). */
export const STATUS_GREEN = '#22C55E'
export const STATUS_AMBER = '#F59E0B'

/** Structural mirrors of the official client sessions store (no @deepseek-ai
 *  runtime import — same policy as the host's types.ts). */
export interface StatusSessionRow {
  id: string
  /** Coarse durable origin; only `subagent` is ever set. */
  origin?: 'subagent'
  running: boolean
  /** Finished while not selected and not yet opened. Absent = false. */
  completed?: boolean
  /** Blocking user interaction; presence = amber. */
  pendingInteraction?: unknown
}

export interface StatusSessionState {
  ids?: readonly string[]
  byId: Record<string, StatusSessionRow>
  current?: string
}

export interface StatusSessionsList {
  getSnapshot(): StatusSessionState
  subscribe(listener: () => void): () => void
}

/** The favicon state the session facts map to; null = keep the original icon. */
export type StatusLightState = 'green' | 'amber' | null

/** Decide the favicon state from the session list snapshot. Subagent rows and
 *  finished-but-visible sessions do not light the whale. */
export function statusOf(
  state: StatusSessionState,
  hiddenDone: ReadonlySet<string> = new Set(),
): StatusLightState {
  let amber = false
  for (const row of Object.values(state.byId)) {
    if (row.origin === 'subagent') continue
    if (row.completed === true || hiddenDone.has(row.id)) return 'green'
    if (row.pendingInteraction !== undefined) amber = true
  }
  return amber ? 'amber' : null
}

/** The whale glyph rendered in one colour, as a favicon-ready data: URL. */
export function whaleDataUrl(hex: string): string {
  return `data:image/svg+xml,${encodeURIComponent(whaleSvgMarkup(hex))}`
}

/** The link element the status light replaces. */
function iconLink(): HTMLLinkElement | null {
  return document.head.querySelector('link[rel~="icon"]')
}

/**
 * Mount the status light over a live sessions list. Returns a disposer that
 * unsubscribes and restores the favicon the page had when this mounted.
 */
export function mountStatusLight(list: StatusSessionsList): () => void {
  const link = iconLink()
  const originalHref = link?.href ?? '/favicon.svg'
  /** The href we set last; null = original icon is in place. */
  let applied: string | null = null
  /** Self-tracked running edges (mirror of the official prevRunning). */
  const prevRunning = new Map<string, boolean>()
  /** Main session finished while selected AND this tab was hidden. */
  const hiddenDone = new Set<string>()

  const setHref = (href: string): void => {
    const current = iconLink()
    if (current !== null) current.href = href
  }
  const restore = (): void => {
    if (applied !== null) {
      setHref(originalHref)
      applied = null
    }
  }

  /** running true→false edges: the host reports "finished while not selected"
   *  via row.completed; the "finished while selected but tab hidden" gap is
   *  tracked here. Re-running and removed sessions clear the entry. */
  function trackEdges(state: StatusSessionState): void {
    for (const row of Object.values(state.byId)) {
      const prev = prevRunning.get(row.id)
      if (prev === undefined) {
        prevRunning.set(row.id, row.running)
        continue
      }
      if (prev && !row.running) {
        if (row.id === state.current && document.visibilityState === 'hidden') hiddenDone.add(row.id)
      } else if (row.running) {
        hiddenDone.delete(row.id)
      }
      prevRunning.set(row.id, row.running)
    }
    for (const id of [...prevRunning.keys()]) {
      if (!(id in state.byId)) {
        prevRunning.delete(id)
        hiddenDone.delete(id)
      }
    }
  }

  /** Green/amber decision; null = original icon. */
  function targetOf(state: StatusSessionState): string | null {
    const stateKind = statusOf(state, hiddenDone)
    if (stateKind === 'green') return whaleDataUrl(STATUS_GREEN)
    if (stateKind === 'amber') return whaleDataUrl(STATUS_AMBER)
    return null
  }

  function sync(): void {
    try {
      const state = list.getSnapshot()
      trackEdges(state)
      const next = targetOf(state)
      if (next === null) restore()
      else if (applied !== next) {
        setHref(next)
        applied = next
      }
    } catch {
      // Never let a status hiccup break the page.
    }
  }

  /** Returning to the tab clears the "finished while hidden" light (V0-02). */
  const onVisibility = (): void => {
    if (document.visibilityState !== 'visible') return
    if (hiddenDone.size > 0) {
      hiddenDone.clear()
      sync()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const unsubscribeList = list.subscribe(sync)
  sync()

  return () => {
    unsubscribeList()
    document.removeEventListener('visibilitychange', onVisibility)
    restore()
  }
}
