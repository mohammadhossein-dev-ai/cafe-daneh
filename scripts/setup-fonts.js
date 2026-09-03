'use strict';
/*
 * setup-fonts.js — آماده‌سازی پوشه‌ها و دانلود فونت‌های محلی (وزیرمتن + امیری)
 * اجرا: node scripts/setup-fonts.js
 * اگر اینترنت ندارید، سایت با فونت‌های جایگزین سیستم هم کار می‌کند.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FONTS = path.join(ROOT, 'public', 'fonts');

const DIRS = [
  path.join(ROOT, 'public', 'css'),
  path.join(ROOT, 'public', 'js'),
  FONTS,
  path.join(ROOT, 'scripts'),
  path.join(ROOT, 'data'),
];

const FILES = [
  {
    file: 'Vazirmatn-arabic-var.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/vazirmatn@5/files/vazirmatn-arabic-wght-normal.woff2',
  },
  {
    file: 'Vazirmatn-latin-var.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource-variable/vazirmatn@5/files/vazirmatn-latin-wght-normal.woff2',
  },
  {
    file: 'Amiri-arabic-400.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5/files/amiri-arabic-400-normal.woff2',
  },
  {
    file: 'Amiri-latin-400.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5/files/amiri-latin-400-normal.woff2',
  },
];

async function main() {
  for (const d of DIRS) fs.mkdirSync(d, { recursive: true });
  for (const { file, url } of FILES) {
    const dest = path.join(FONTS, file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
      console.log('SKIP (exists):', file);
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log('OK:', file, buf.length, 'bytes');
    } catch (err) {
      console.log('FAIL:', file, '-', err.message);
    }
  }
  const all = fs.readdirSync(FONTS);
  console.log('fonts dir:', all.join(', ') || '(empty)');
}

main();
