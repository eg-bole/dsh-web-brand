import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  brandIndexHtml, dataUrlType, isRemoteIcon, mimeOfIconFile,
} from '../src/branding.ts'
import { ICON_ENV, mergeBrand, resolveIcon, TITLE_ENV } from '../src/index.ts'

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>DeepSeek Harness</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

describe('brandIndexHtml', () => {
  it('prefixes the title and rewrites the favicon link', () => {
    const out = brandIndexHtml(INDEX, { title: 'Yao', iconHref: '/dsh-web-brand/icon?rev=abc', iconType: 'image/png' })
    expect(out).toContain('<title>Yao - DeepSeek Harness</title>')
    expect(out).toContain('<link rel="icon" type="image/png" href="/dsh-web-brand/icon?rev=abc">')
    expect(out).not.toContain('href="/favicon.svg"')
  })

  it('leaves an already-branded title alone (idempotent)', () => {
    const once = brandIndexHtml(INDEX, { title: 'Yao' })
    const twice = brandIndexHtml(once, { title: 'Yao' })
    expect(twice).toBe(once)
    expect(twice).toContain('<title>Yao - DeepSeek Harness</title>')
  })

  it('escapes HTML in the brand text', () => {
    const out = brandIndexHtml(INDEX, { title: 'A&B<C>' })
    expect(out).toContain('<title>A&amp;B&lt;C&gt; - DeepSeek Harness</title>')
  })

  it('inserts a favicon link when the index has none', () => {
    const bare = INDEX.replace(/<link rel="icon"[^>]*>\n    /, '')
    expect(bare).not.toContain('rel="icon"')
    const out = brandIndexHtml(bare, { title: 'Yao', iconHref: '/x.png', iconType: 'image/png' })
    expect(out).toContain('<link rel="icon" type="image/png" href="/x.png">')
  })

  // The stock index ships a dark and a light icon link; leaving the second in
  // place would keep the stock whale in whichever theme it covers.
  it('collapses the theme-scoped icon links the stock index ships into one', () => {
    const themed = INDEX.replace(
      '    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
      '    <link rel="icon" type="image/svg+xml" href="/favicon-dark.svg" media="(prefers-color-scheme: dark)" />\n'
      + '    <link rel="icon" type="image/svg+xml" href="/favicon.svg" media="(prefers-color-scheme: light)" />',
    )
    expect(themed.match(/rel="icon"/g)).toHaveLength(2)
    const out = brandIndexHtml(themed, { iconHref: '/brand.svg', iconType: 'image/svg+xml' })
    expect(out.match(/rel="icon"/g)).toHaveLength(1)
    expect(out).toContain('<link rel="icon" type="image/svg+xml" href="/brand.svg">')
    expect(out).not.toContain('favicon-dark.svg')
    expect(out).not.toContain('favicon.svg')
  })

  it('is idempotent over the collapsed icon link', () => {
    const themed = INDEX.replace(
      '    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
      '    <link rel="icon" href="/favicon-dark.svg" media="(prefers-color-scheme: dark)" />\n'
      + '    <link rel="icon" href="/favicon.svg" media="(prefers-color-scheme: light)" />',
    )
    const once = brandIndexHtml(themed, { iconHref: '/brand.svg' })
    expect(brandIndexHtml(once, { iconHref: '/brand.svg' })).toBe(once)
  })

  it('supports an empty original title (brand alone)', () => {
    const out = brandIndexHtml(INDEX.replace('<title>DeepSeek Harness</title>', '<title></title>'), { title: 'Yao' })
    expect(out).toContain('<title>Yao</title>')
  })
})

describe('icon formats', () => {
  it('maps every supported extension to its MIME type', () => {
    expect(mimeOfIconFile('a.svg')).toBe('image/svg+xml')
    expect(mimeOfIconFile('a.png')).toBe('image/png')
    expect(mimeOfIconFile('a.ico')).toBe('image/x-icon')
    expect(mimeOfIconFile('a.jpg')).toBe('image/jpeg')
    expect(mimeOfIconFile('a.jpeg')).toBe('image/jpeg')
    expect(mimeOfIconFile('a.webp')).toBe('image/webp')
    expect(mimeOfIconFile('a.gif')).toBe('image/gif')
    expect(mimeOfIconFile('a.avif')).toBe('image/avif')
    expect(mimeOfIconFile('a.exe')).toBeUndefined()
  })

  it('recognizes pass-through URLs', () => {
    expect(isRemoteIcon('https://example.com/favicon.svg')).toBe(true)
    expect(isRemoteIcon('data:image/png;base64,AAA=')).toBe(true)
    expect(isRemoteIcon('./brand.png')).toBe(false)
    expect(isRemoteIcon('C:\\brand.ico')).toBe(false)
  })

  it('extracts the media type of a data: URL', () => {
    expect(dataUrlType('data:image/png;base64,AAA=')).toBe('image/png')
    expect(dataUrlType('data:image/svg+xml,%3Csvg%3E')).toBe('image/svg+xml')
    expect(dataUrlType('https://example.com/x.svg')).toBeUndefined()
  })

  it('accepts a png file and serves it behind a hash cache-buster', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-web-brand-'))
    const file = join(dir, 'brand.png')
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const icon = resolveIcon(file, process.cwd())
    expect(icon.type).toBe('image/png')
    expect(icon.href).toMatch(/^\/dsh-web-brand\/icon\?rev=[0-9a-f]{12}$/)
    expect(icon.served?.bytes).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  })

  it('fails loud on a missing file and an unknown format', () => {
    expect(() => resolveIcon('/nonexistent/definitely-missing.svg', process.cwd()))
      .toThrow(/not readable/)
    expect(() => resolveIcon('/tmp/brand.exe', process.cwd()))
      .toThrow(/unrecognized format/)
  })
})

describe('mergeBrand (flag > env > row config)', () => {
  const rowConfig = { title: 'from-config', icon: 'config.svg' }

  it('flag wins over env and config', () => {
    expect(mergeBrand({ title: 'from-flag', icon: 'flag.svg' }, rowConfig, { [TITLE_ENV]: 'from-env', [ICON_ENV]: 'env.svg' }))
      .toEqual({ title: 'from-flag', icon: 'flag.svg' })
  })

  it('env wins over row config when no flag', () => {
    expect(mergeBrand(undefined, rowConfig, { [TITLE_ENV]: 'from-env', [ICON_ENV]: 'env.svg' }))
      .toEqual({ title: 'from-env', icon: 'env.svg' })
  })

  it('row config is the fallback when neither flag nor env is set', () => {
    expect(mergeBrand(undefined, rowConfig, {})).toEqual({ title: 'from-config', icon: 'config.svg' })
    expect(mergeBrand(undefined, undefined, {})).toEqual({})
  })

  it('drops blank values', () => {
    expect(mergeBrand({ title: '   ', icon: '  ' }, { title: 'ok' }, {})).toEqual({ title: 'ok' })
  })
})
