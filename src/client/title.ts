/**
 * Pure client title logic. The client never needs to know what dsh's
 * "product title" is: the brand is a fixed prefix on whatever dsh puts in
 * document.title (the product title, or "<session> — <product>"), so the
 * default page reads "Yao - DeepSeek Harness" and a session reads
 * "Yao - <session> — DeepSeek Harness" — the brand is always at the front,
 * which is exactly what distinguishes servers at a glance.
 */

/** Matches the host-side separator (host sends it; this is only a fallback). */
export const DEFAULT_SEPARATOR = ' - '

/**
 * The branded title for the current document.title, or undefined when no
 * write is needed: the title is empty (boot, before dsh renders), or it
 * already carries the brand prefix (this observer's own previous write —
 * the guard that stops MutationObserver feedback loops).
 * @param current - the current document.title.
 * @param title - the brand title.
 * @param sep - separator between brand and original title.
 */
export function brandedTitle(current: string, title: string, sep: string = DEFAULT_SEPARATOR): string | undefined {
  const brand = title.trim()
  if (brand === '') return undefined
  const prefix = `${brand}${sep}`
  if (current === '' || current.startsWith(prefix)) return undefined
  return `${prefix}${current}`
}
