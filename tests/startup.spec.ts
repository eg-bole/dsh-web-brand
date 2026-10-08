import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { apply, WEB_STARTUP_SERVICE } from '../src/startup.ts'

interface Harness {
  /** The service the startup row published, or undefined when it published none. */
  webStartup: () => Record<string, unknown> | undefined
  /** The exit code the command requested, or undefined when it requested none. */
  exitCode: () => number | undefined
}

/**
 * Run the startup row over one argument vector against a real cordis context
 * carrying the launcher facts (cmdlineArgs + appExit), the way the app boot
 * provides them.
 */
function run(args: readonly string[]): Harness {
  const ctx = new Context()
  let code: number | undefined
  ctx.provide('cmdlineArgs', { get: () => args })
  ctx.provide('appExit', (value: number) => { code = value })
  apply(ctx)
  return {
    webStartup: () => ctx.get(WEB_STARTUP_SERVICE) as Record<string, unknown> | undefined,
    exitCode: () => code,
  }
}

describe('web-brand startup row (superset of the official web-startup)', () => {
  it('publishes the official flag family plus the brand extension', () => {
    const harness = run([
      '--host', '127.0.0.1', '--port', '8080', '--no-open',
      '--trusted-host', 'lab.internal', '--title', ' Yao ', '--icon', './brand.svg',
    ])
    expect(harness.exitCode()).toBeUndefined()
    expect(harness.webStartup()).toEqual({
      openBrowser: false,
      host: '127.0.0.1',
      port: 8080,
      trustedHosts: ['lab.internal'],
      title: 'Yao',
      icon: './brand.svg',
    })
  })

  it('carries --public-url through to the service', () => {
    const harness = run(['--public-url', 'https://app.example/ui/', '--no-open'])
    expect(harness.exitCode()).toBeUndefined()
    expect(harness.webStartup()).toEqual({
      openBrowser: false,
      publicUrl: 'https://app.example/ui/',
      trustedHosts: [],
    })
  })

  it('leaves host/port/publicUrl absent when the invocation named none', () => {
    expect(run([]).webStartup()).toEqual({ openBrowser: true, trustedHosts: [] })
  })

  it('rejects a malformed invocation with the official exit request', () => {
    // Each of these is a usage error in the official provider too, so the
    // superset must refuse rather than publish a half-built service.
    for (const args of [
      ['--host', '0.0.0.0'],
      ['--port', 'abc'],
      ['--public-url', 'app.example'],
    ]) {
      const harness = run(args)
      expect(harness.exitCode(), args.join(' ')).toBe(1)
      expect(harness.webStartup(), args.join(' ')).toBeUndefined()
    }
  })

  it('omits a blank --title rather than publishing an empty brand', () => {
    expect(run(['--title', '   ']).webStartup()).toEqual({ openBrowser: true, trustedHosts: [] })
  })
})
