import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'
import type { BrandGlobalRow } from '../src/types.ts'

const INDEX = (title = 'DeepSeek Harness'): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

interface FakeRoute { path: string; handler: (req: unknown, res: unknown) => void }

/** A fake host context implementing exactly the face apply() consumes. */
function mountHost(brand: { title?: string; icon?: string }, config?: object) {
  const taps: ((html: string) => string)[] = []
  const routes: FakeRoute[] = []
  const disposers: (() => void)[] = []
  let collectGlobal: ((table: { push(row: BrandGlobalRow): void }) => void) | undefined
  const host = {
    webStartup: { openBrowser: true, trustedHosts: [], ...brand },
    webRuntime: { trustedHosts: ['lab.internal'] },
    webServer: {
      register(route: FakeRoute) {
        routes.push(route)
        return () => {
          const at = routes.indexOf(route)
          if (at !== -1) routes.splice(at, 1)
        }
      },
      tapIndex(transform: (html: string) => string) {
        taps.push(transform)
        return () => {
          const at = taps.indexOf(transform)
          if (at !== -1) taps.splice(at, 1)
        }
      },
    },
    on(_event: string, listener: (table: { push(row: BrandGlobalRow): void }) => void) {
      collectGlobal = listener
      return () => { collectGlobal = undefined }
    },
    effect(execute: () => () => void) {
      const cleanup = execute()
      disposers.push(cleanup)
    },
  }
  apply(host as unknown as Context, config)
  const brandHtml = (): string => {
    let out = INDEX()
    for (const tap of taps) out = tap(out)
    return out
  }
  const globals = (): BrandGlobalRow[] => {
    const table: BrandGlobalRow[] = []
    collectGlobal?.({ push: row => table.push(row) })
    return table
  }
  return { host, brandHtml, globals, routes, disposers, taps }
}

function fakeResponse() {
  let status = 0
  let headers: Record<string, string> = {}
  let body: string | Uint8Array | undefined
  return {
    res: {
      writeHead(code: number, h: Record<string, string> = {}) {
        status = code
        headers = h
      },
      end(b?: string | Uint8Array) {
        body = b
      },
    },
    get status() { return status },
    get headers() { return headers },
    get body() { return body },
  }
}

describe('host apply (web-brand row)', () => {
  it('rewrites the served index and publishes the global row', () => {
    const mount = mountHost({ title: 'Yao' })
    expect(mount.brandHtml()).toContain('<title>Yao - DeepSeek Harness</title>')
    expect(mount.globals()).toEqual([{ kind: 'global', name: '__DSH_WEB_BRAND__', value: { title: 'Yao', sep: ' - ' } }])
    expect(mount.routes).toEqual([]) // no icon → no route
  })

  it('is a silent no-op when nothing is branded anywhere', () => {
    const mount = mountHost({}, {})
    expect(mount.taps).toEqual([])
    expect(mount.routes).toEqual([])
    expect(mount.disposers).toEqual([])
  })

  it('serves a local icon file behind the trust fence and immutable cache', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-web-brand-'))
    const file = join(dir, 'brand.svg')
    writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg"/>')
    const mount = mountHost({ icon: file })
    const html = mount.brandHtml()
    const href = /href="([^"]+)"/.exec(html)?.[1]
    expect(href).toMatch(/^\/dsh-web-brand\/icon\?rev=[0-9a-f]{12}$/)

    const route = mount.routes[0]!
    expect(route.path).toBe('/dsh-web-brand/icon')

    // Trusted loopback request → 200 + bytes + immutable cache headers.
    const ok = fakeResponse()
    route.handler(
      { url: href!, method: 'GET', headers: { host: '127.0.0.1:3081' } },
      ok.res,
    )
    expect(ok.status).toBe(200)
    expect(ok.headers['content-type']).toBe('image/svg+xml')
    expect(ok.headers['cache-control']).toContain('immutable')
    expect(ok.body).toBeInstanceOf(Uint8Array)

    // Cross-site browser marker → refused.
    const bad = fakeResponse()
    route.handler(
      { url: href!, method: 'GET', headers: { host: '127.0.0.1:3081', origin: 'https://evil.example' } },
      bad.res,
    )
    expect(bad.status).toBe(403)
  })

  it('dispose unregisters every effect', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-web-brand-'))
    const file = join(dir, 'brand.png')
    writeFileSync(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const mount = mountHost({ title: 'Yao', icon: file })
    expect(mount.routes).toHaveLength(1)
    expect(mount.taps).toHaveLength(1)
    for (const dispose of [...mount.disposers].reverse()) dispose()
    expect(mount.routes).toHaveLength(0)
    expect(mount.taps).toHaveLength(0)
    expect(mount.globals()).toEqual([])
  })
})
