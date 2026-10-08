import { describe, expect, it } from 'vitest'
import {
  statusOf, STATUS_AMBER, STATUS_GREEN, whaleDataUrl,
  type StatusListState, type StatusSessionRow, type StatusSnapshot, type StatusSessionStatus,
} from '../src/client/status-light.ts'
import { WHALE_PATH } from '../src/client/whale.ts'

/** The official catalog rows, keyed by session id. */
function list(rows: Record<string, StatusSessionRow>): StatusListState {
  return { byId: rows }
}

/** The official `uiSession` status map, keyed by session id. */
function statuses(rows: Record<string, Partial<StatusSessionStatus>>): StatusSnapshot {
  return new Map(Object.entries(rows).map(([id, row]) => [id, {
    running: row.running,
    pendingInteraction: row.pendingInteraction,
    completionUnread: row.completionUnread ?? false,
  }]))
}

/** A main-session catalog row (no origin mark). */
const main: StatusSessionRow = {}

/** A catalog row for a durable subagent. */
const subagent: StatusSessionRow = { origin: 'subagent' }

describe('statusOf (whale status-light decision)', () => {
  it('keeps the original icon while nothing is running or awaiting', () => {
    expect(statusOf(list({}), statuses({}))).toBeNull()
    expect(statusOf(list({ a: main, b: main }), statuses({ a: {}, b: { running: true } }))).toBeNull()
  })

  it('goes green when a main session finished unread', () => {
    expect(statusOf(list({ a: main }), statuses({ a: { completionUnread: true } }))).toBe('green')
    expect(statusOf(list({ a: main, b: main }), statuses({ a: {}, b: { completionUnread: true } })))
      .toBe('green')
  })

  it('goes amber when any main session waits for a visible interaction', () => {
    expect(statusOf(list({ a: main }), statuses({ a: { pendingInteraction: { kind: 'question' } } })))
      .toBe('amber')
    expect(statusOf(list({ a: main, b: main }), statuses({
      a: {},
      b: { running: true, pendingInteraction: { kind: 'approval' } },
    }))).toBe('amber')
    expect(statusOf(list({ a: main }), statuses({ a: { pendingInteraction: { kind: 'plan-review' } } })))
      .toBe('amber')
  })

  it('ignores an interaction kind the official UI does not surface', () => {
    expect(statusOf(list({ a: main }), statuses({ a: { pendingInteraction: { kind: 'internal' } } })))
      .toBeNull()
  })

  it('prefers green over amber', () => {
    expect(statusOf(list({ a: main, b: main }), statuses({
      a: { pendingInteraction: { kind: 'question' } },
      b: { completionUnread: true },
    }))).toBe('green')
  })

  it('ignores subagent rows entirely', () => {
    expect(statusOf(list({ child: subagent, child2: subagent }), statuses({
      child: { completionUnread: true },
      child2: { pendingInteraction: { kind: 'question' } },
    }))).toBeNull()
  })

  it('lets a pending main session light amber even next to subagent activity', () => {
    expect(statusOf(list({ child: subagent, m: main }), statuses({
      child: { running: true },
      m: { pendingInteraction: { kind: 'question' } },
    }))).toBe('amber')
  })

  it('ignores status rows with no catalog entry (not yet known as a session)', () => {
    expect(statusOf(list({}), statuses({ ghost: { completionUnread: true } }))).toBeNull()
  })
})

describe('whaleDataUrl (coloured favicon)', () => {
  it('renders the official whale path in the status colour', () => {
    for (const hex of [STATUS_GREEN, STATUS_AMBER] as const) {
      const url = whaleDataUrl(hex)
      expect(url).toMatch(/^data:image\/svg\+xml,/)
      expect(decodeURIComponent(url)).toContain(hex)
      expect(decodeURIComponent(url)).toContain(WHALE_PATH.slice(0, 80))
    }
  })
})
