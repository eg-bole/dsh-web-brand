import { describe, expect, it } from 'vitest'
import {
  statusOf, STATUS_AMBER, STATUS_GREEN, whaleDataUrl,
  type StatusSessionState,
} from '../src/client/status-light.ts'
import { WHALE_PATH } from '../src/client/whale.ts'

function row(id: string, overrides: Partial<{
  origin: 'subagent'
  running: boolean
  completed: boolean
  pendingInteraction: unknown
}> = {}): StatusSessionState['byId'][string] {
  return {
    id,
    running: overrides.running ?? false,
    ...'origin' in overrides && overrides.origin !== undefined ? { origin: overrides.origin } : {},
    ...overrides.completed === true ? { completed: true } : {},
    ...'pendingInteraction' in overrides && overrides.pendingInteraction !== undefined
      ? { pendingInteraction: overrides.pendingInteraction }
      : {},
  }
}

function state(rows: StatusSessionState['byId'][string][], current?: string): StatusSessionState {
  return {
    ids: rows.map(r => r.id),
    byId: Object.fromEntries(rows.map(r => [r.id, r])),
    current,
  }
}

describe('statusOf (whale status-light decision)', () => {
  it('keeps the original icon while nothing is running or awaiting', () => {
    expect(statusOf(state([]))).toBeNull()
    expect(statusOf(state([row('a'), row('b', { running: true })]))).toBeNull()
  })

  it('goes green when a main session is completed (finished while unopened)', () => {
    expect(statusOf(state([row('a', { completed: true })]))).toBe('green')
    expect(statusOf(state([row('a'), row('b', { completed: true })]))).toBe('green')
  })

  it('goes green for a session that finished while hidden and selected', () => {
    expect(statusOf(state([row('a')]), new Set(['a']))).toBe('green')
  })

  it('goes amber when any main session waits for interaction', () => {
    expect(statusOf(state([row('a', { pendingInteraction: { kind: 'ask' } })]))).toBe('amber')
    expect(statusOf(state([
      row('a'),
      row('b', { running: true, pendingInteraction: { kind: 'approval' } }),
    ]))).toBe('amber')
  })

  it('prefers green over amber', () => {
    expect(statusOf(state([
      row('a', { pendingInteraction: {} }),
      row('b', { completed: true }),
    ]))).toBe('green')
  })

  it('ignores subagent rows entirely', () => {
    expect(statusOf(state([
      row('child', { origin: 'subagent', completed: true }),
      row('child2', { origin: 'subagent', pendingInteraction: {} }),
    ]))).toBeNull()
  })

  it('lets a pending main session light amber even next to subagent activity', () => {
    expect(statusOf(state([
      row('child', { origin: 'subagent', running: true }),
      row('main', { pendingInteraction: {} }),
    ]))).toBe('amber')
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
