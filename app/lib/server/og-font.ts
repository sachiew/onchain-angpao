import "server-only";

/**
 * Satori's bundled font is Latin-only, so CJK greetings would render as boxes. Fetch a
 * Google Fonts subset containing just the characters we draw (a few KB). The text is the
 * angpao's public onchain greeting. Returns null on failure; the image still renders.
 */
const cache = new Map<string, ArrayBuffer>();

export async function loadSubsetFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].join("");
  const key = `${family}:${weight}:${chars}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(chars)}`,
        { signal: AbortSignal.timeout(3000) },
      )
    ).text();
    // No browser User-Agent → Google serves TrueType, which Satori can parse.
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const font = await (await fetch(url, { signal: AbortSignal.timeout(3000) })).arrayBuffer();
    if (cache.size > 200) cache.clear();
    cache.set(key, font);
    return font;
  } catch {
    return null;
  }
}
