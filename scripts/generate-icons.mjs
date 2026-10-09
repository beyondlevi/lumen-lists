// Renders the monochrome app icon (white glyph on a transparent background,
// as the Meta docs recommend for glasses icons) into public/icon-*.png.
// Usage: npm run icons
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// A list with a check: a checked box, then three lines.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g fill="none" stroke="#ffffff" stroke-width="36" stroke-linecap="round" stroke-linejoin="round">
    <path d="M72 128l40 40 72-80"/>
    <path d="M248 128h192M248 256h192M248 384h192"/>
    <rect x="76" y="220" width="72" height="72" rx="14"/>
    <rect x="76" y="348" width="72" height="72" rx="14"/>
  </g>
</svg>`;

for (const size of [192, 512]) {
  const out = path.join(root, 'public', `icon-${size}.png`);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log(`icon: ${path.relative(root, out)}`);
}
