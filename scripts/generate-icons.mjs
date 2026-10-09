// Renders the monochrome app icon (white glyph on a transparent background,
// as the Meta docs recommend for glasses icons) into public/icon-*.png.
// Usage: npm run icons
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// A shopping cart: basket, handle and two wheels.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g fill="none" stroke="#ffffff" stroke-width="36" stroke-linecap="round" stroke-linejoin="round">
    <path d="M48 88h56l52 236h236l44-176H128"/>
  </g>
  <circle cx="184" cy="408" r="36" fill="#ffffff"/>
  <circle cx="368" cy="408" r="36" fill="#ffffff"/>
</svg>`;

for (const size of [192, 512]) {
  const out = path.join(root, 'public', `icon-${size}.png`);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log(`icon: ${path.relative(root, out)}`);
}
