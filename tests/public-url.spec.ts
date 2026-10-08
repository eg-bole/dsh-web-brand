import { describe, expect, it } from 'vitest'
import { parsePublicUrl } from '../src/public-url.ts'

describe('parsePublicUrl (mirror of the official web-app parser)', () => {
  it('accepts an absolute http(s) root and normalizes its path to end in /', () => {
    expect(parsePublicUrl('https://app.example').pathname).toBe('/')
    expect(parsePublicUrl('https://app.example/ui').pathname).toBe('/ui/')
    expect(parsePublicUrl('https://app.example/ui/').pathname).toBe('/ui/')
    expect(parsePublicUrl('http://127.0.0.1:3082').host).toBe('127.0.0.1:3082')
  })

  it('names the flag in every rejection', () => {
    const cases: readonly string[] = [
      '',
      'app.example',
      'ftp://app.example',
      'https://app.example/a b',
      'https://app.example?x=1',
      'https://app.example#frag',
      'https://',
      'https:///ui',
    ]
    for (const value of cases) {
      expect(() => parsePublicUrl(value, '--public-url')).toThrow(/--public-url/)
    }
  })

  it('rejects credentials, including an empty username', () => {
    expect(() => parsePublicUrl('https://user:pw@app.example/', '--public-url')).toThrow(/credentials/)
    expect(() => parsePublicUrl('https://@app.example/', '--public-url')).toThrow(/credentials/)
  })

  it('rejects whitespace and control characters anywhere in the value', () => {
    expect(() => parsePublicUrl('https://app.example/\n', '--public-url')).toThrow(/whitespace/)
    expect(() => parsePublicUrl('  https://app.example', '--public-url')).toThrow(/whitespace/)
  })
})
