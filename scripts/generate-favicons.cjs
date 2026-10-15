const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

async function generate() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });

  const svgPath = path.resolve('public/favicon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  // Load SVG into page
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; overflow: hidden; }
          svg { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
    </html>
  `);

  // Generate 32x32 PNG for favicon.ico
  await page.setViewportSize({ width: 32, height: 32 });
  const png32Buffer = await page.screenshot({ omitBackground: true });
  fs.writeFileSync('public/favicon-32x32.png', png32Buffer);

  // Generate 180x180 Apple Touch Icon
  await page.setViewportSize({ width: 180, height: 180 });
  const png180Buffer = await page.screenshot({ omitBackground: true });
  fs.writeFileSync('public/apple-touch-icon.png', png180Buffer);

  // Generate 192x192 Android / PWA Icon
  await page.setViewportSize({ width: 192, height: 192 });
  const png192Buffer = await page.screenshot({ omitBackground: true });
  fs.writeFileSync('public/icon-192.png', png192Buffer);

  // Pack 32x32 PNG into a standard ICO file
  // ICO Header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(1, 4); // Count of images = 1

  // Directory entry: 16 bytes
  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);  // Width
  entry.writeUInt8(32, 1);  // Height
  entry.writeUInt8(0, 2);   // Color palette
  entry.writeUInt8(0, 3);   // Reserved
  entry.writeUInt16LE(1, 4); // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel
  entry.writeUInt32LE(png32Buffer.length, 8); // Size of image data
  entry.writeUInt32LE(22, 12); // Offset (6 + 16 = 22)

  const icoBuffer = Buffer.concat([header, entry, png32Buffer]);
  fs.writeFileSync('public/favicon.ico', icoBuffer);
  fs.writeFileSync('landing/public/favicon.ico', icoBuffer);
  fs.writeFileSync('landing/public/favicon-32x32.png', png32Buffer);
  fs.writeFileSync('landing/public/apple-touch-icon.png', png180Buffer);

  console.log('Successfully generated:');
  console.log('- public/favicon.svg');
  console.log('- public/favicon.ico');
  console.log('- public/favicon-32x32.png');
  console.log('- public/apple-touch-icon.png');
  console.log('- public/icon-192.png');
  console.log('- landing/public/favicon.ico & icons');

  await browser.close();
}

generate().catch(err => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});
