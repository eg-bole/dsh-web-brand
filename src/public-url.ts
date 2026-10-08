/**
 * `--public-url` validation, behaviorally identical to the official
 * `parsePublicUrl` in @deepseek-ai/dsh-web-app (src/public-url.ts,
 * BSD-3-Clause, copied here because the package exports no such subpath and
 * the plugin must not reach into its internals — the same rationale
 * src/fence.ts follows).
 *
 * The plugin's startup row replaces the official `web-startup` row, so it
 * owns the whole web flag family and must validate `--public-url` itself;
 * otherwise the flag would be admitted and then ignored.
 *
 * Upstream added `--public-url` after dsh 0.2.0-rc.2, where `publicUrl` has
 * no consumer. Accepting it there is inert: the value rides the `webStartup`
 * service alongside the fields that version already reads.
 * @module dsh-web-brand/public-url
 */

/**
 * Parse the advertised public HTTP(S) root of a prefix-stripping proxy
 * deployment, rejecting the hazards WHATWG URL parsing would accept on its
 * own, then normalize the path to end in `/`.
 * @param value - advertised public HTTP(S) root.
 * @param label - field name or CLI flag included in rejection messages.
 * @returns the parsed URL with a trailing-slash pathname.
 * @throws when the value is not a usable advertised root, naming the reason.
 */
export function parsePublicUrl(value: string, label = 'publicUrl'): URL {
  if (/[\u0000-\u0020\u007f]/u.test(value)) {
    throw new Error(`${label} must not contain ASCII whitespace or control characters`)
  }
  if (!/^https?:\/\//iu.test(value)) {
    throw new Error(`${label} must be an absolute http or https URL of the form http(s)://host[/prefix]`)
  }
  if (value.includes('?') || value.includes('#')) {
    throw new Error(`${label} must not include a query or fragment (? or #)`)
  }
  // Userinfo lives in the raw authority (before the first path slash); the
  // empty-authority forms (`https://`, `https:///ui`, `http:///ui`) fail here too.
  const [authority = ''] = value.slice(value.indexOf('://') + 3).split(/[/\\]/, 1)
  if (authority === '') {
    throw new Error(`${label} must name a host after http:// or https://`)
  }
  if (authority.includes('@')) {
    throw new Error(`${label} must not include credentials (a username or password before @, including an empty user)`)
  }
  const url = URL.parse(value)
  if (url === null) throw new Error(`${label} must be an absolute http or https URL`)
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url
}
