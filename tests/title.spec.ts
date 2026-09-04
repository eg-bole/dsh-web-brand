import { describe, expect, it } from 'vitest'
import { brandedTitle, DEFAULT_SEPARATOR } from '../src/client/title.ts'

describe('brandedTitle', () => {
  it('prefixes the bare product title (default page)', () => {
    expect(brandedTitle('DeepSeek Harness', 'Yao')).toBe('Yao - DeepSeek Harness')
  })

  it('prefixes a session title and keeps the dsh-native suffix', () => {
    expect(brandedTitle('我的会话 — DeepSeek Harness', 'Yao')).toBe('Yao - 我的会话 — DeepSeek Harness')
  })

  it('honors a custom separator', () => {
    expect(brandedTitle('DeepSeek Harness', 'Yao', ' — ')).toBe('Yao — DeepSeek Harness')
  })

  it('returns undefined (no write) when the title already carries the brand', () => {
    const prefixed = brandedTitle('DeepSeek Harness', 'Yao', DEFAULT_SEPARATOR)!
    expect(brandedTitle(prefixed, 'Yao', DEFAULT_SEPARATOR)).toBeUndefined()
  })

  it('returns undefined for an empty title or an empty brand', () => {
    expect(brandedTitle('', 'Yao')).toBeUndefined()
    expect(brandedTitle('DeepSeek Harness', '   ')).toBeUndefined()
    expect(brandedTitle('DeepSeek Harness', '')).toBeUndefined()
  })

  it('brands even a title that is not the dsh product form', () => {
    expect(brandedTitle('anything at all', 'Yao')).toBe('Yao - anything at all')
  })
})
