/**
 * Pure branding transforms: turn a served index.html body into its branded
 * form. Kept free of cordis/fs so unit tests run without a host tree.
 *
 * The separator between the brand and the original title is ' - ' (the
 * browser-tab width cost of a full-width em dash is worse); the client half
 * receives it through the global row so host and browser can never drift.
 */
import { createHash } from 'node:crypto'

/** Text inserted between the brand and whatever dsh would have shown. */
export const DEFAULT_SEPARATOR = ' - '

/** One index.html branding pass. */
export interface IndexBrandTap {
  /** Brand title: every page title becomes `<brand><sep><original>`. */
  title?: string
  /** Replaces the favicon link's href (a route or an http(s):/data: URL). */
  iconHref?: string
  /** MIME type written into the favicon link's type attribute (optional). */
  iconType?: string
}

/** Escape build-time text before placing it in an HTML element. */
function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escape text before placing it in a quoted HTML attribute. */
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** A favicon link element built from the branded values. */
export function iconLinkMarkup(tap: IndexBrandTap): string {
  const type = tap.iconType === undefined ? '' : ` type="${escapeHtmlAttribute(tap.iconType)}"`
  return `<link rel="icon"${type} href="${escapeHtmlAttribute(tap.iconHref ?? '')}">`
}

/**
 * Apply the branding pass to one index.html body. Idempotent per field: a
 * title that already carries the brand prefix, or an icon link already
 * pointing at the branded href, is left alone.
 * @param html - the raw index.html body.
 * @param tap - the branding values (absent fields are skipped).
 * @param sep - separator between brand and original title.
 * @returns the branded body.
 */
export function brandIndexHtml(html: string, tap: IndexBrandTap, sep: string = DEFAULT_SEPARATOR): string {
  let out = html
  const title = tap.title
  if (title !== undefined && title !== '') {
    const prefix = `${title}${sep}`
    out = out.replace(/<title[^>]*>([\s\S]*?)<\/title>/i, (_match, inner: string) => {
      const content = inner.trim()
      if (content.startsWith(prefix)) return _match
      const branded = content === '' ? title : `${prefix}${content}`
      return `<title>${escapeHtmlText(branded)}</title>`
    })
  }
  if (tap.iconHref !== undefined && tap.iconHref !== '') {
    const link = iconLinkMarkup(tap)
    // The stock dsh page carries exactly one `<link rel="icon" ...>`; rewrite
    // it in place so the browser trust order stays unchanged.
    const iconLinkRe = /<link\s+rel="icon"[^>]*>/i
    if (iconLinkRe.test(out)) {
      out = out.replace(iconLinkRe, () => link)
    } else {
      // No icon link (custom index): insert one at the top of the head.
      out = out.replace(/<head[^>]*>/i, match => `${match}\n    ${link}`)
    }
  }
  return out
}

/**
 * MIME type of a local icon file by its extension, or undefined when the
 * extension is not a recognized favicon format. Browsers accept SVG, PNG,
 * and ICO as favicons everywhere; JPEG/WebP/GIF/AVIF work in modern
 * Chromium and Firefox.
 */
export function mimeOfIconFile(path: string): string | undefined {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return undefined
  const ext = path.slice(dot + 1).toLowerCase()
  switch (ext) {
    case 'svg': return 'image/svg+xml'
    case 'png': return 'image/png'
    case 'ico': return 'image/x-icon'
    case 'jpg': return 'image/jpeg'
    case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'gif': return 'image/gif'
    case 'avif': return 'image/avif'
    default: return undefined
  }
}

/** Recognized favicon extensions, for error messages and docs. */
export const SUPPORTED_ICON_FORMATS = ['svg', 'png', 'ico', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] as const

/** Whether an icon value is a pass-through URL rather than a local file. */
export function isRemoteIcon(value: string): boolean {
  return /^(?:https?:|data:)/i.test(value)
}

/** The media type of a data: URL (e.g. data:image/png;base64,.. → image/png). */
export function dataUrlType(value: string): string | undefined {
  if (!value.startsWith('data:')) return undefined
  const comma = value.indexOf(',')
  const head = comma === -1 ? value : value.slice(0, comma)
  const semi = head.indexOf(';')
  const media = (semi === -1 ? head : head.slice(0, semi)).slice('data:'.length)
  return media === '' ? undefined : media
}

/** sha1 content hash shortened to 12 hex chars (favicon cache-busting rev). */
export function shortHash(input: Buffer): string {
  return createHash('sha1').update(input).digest('hex').slice(0, 12)
}
