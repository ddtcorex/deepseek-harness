import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const DIST_ROOT = fileURLToPath(new URL('../dist', import.meta.url))

it('ships install metadata with the built web application', async () => {
  const index = await readFile(join(DIST_ROOT, 'index.html'), 'utf8')
  expect(index).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
  expect(index).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')

  const manifest: unknown = JSON.parse(await readFile(join(DIST_ROOT, 'manifest.webmanifest'), 'utf8'))
  expect(manifest).toEqual({
    id: '/',
    name: 'DeepSeek Harness',
    short_name: 'DSH',
    start_url: '/',
    scope: '/',
    display: 'fullscreen',
    icons: [{
      src: '/favicon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any',
    }],
  })
})

it('ships a favicon that switches to a light mark under dark color scheme', async () => {
  const favicon = await readFile(join(DIST_ROOT, 'favicon.svg'), 'utf8')
  // The light fill must live inside the dark-scheme media query, so the icon
  // stays black in light mode and only turns white under a dark scheme.
  expect(favicon).toMatch(/@media \(prefers-color-scheme: dark\)\s*{\s*path\s*{[^}]*fill:\s*#fff/i)
  expect(favicon).toContain('fill="#000"')
})

// iOS Safari's "Add to Home Screen" ignores manifest.webmanifest icons and
// SVG favicons entirely; it only reads a PNG apple-touch-icon link. Without
// this asset the installed icon falls back to a generic placeholder.
it('ships an opaque PNG apple-touch-icon at the size iOS expects', async () => {
  const png = await readFile(join(DIST_ROOT, 'apple-touch-icon.png'))
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE)
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR')
  expect(png.readUInt32BE(16)).toBe(180)
  expect(png.readUInt32BE(20)).toBe(180)
  // Color type 2 = truecolor (RGB, no alpha) — iOS composites its own corner
  // mask and rejects transparency, so the icon must be fully opaque.
  expect(png.readUInt8(25)).toBe(2)
})
