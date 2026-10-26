import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mediaDir = path.resolve(__dirname, '../media');
const outDir = path.resolve(__dirname, '../public/site');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const imagesToProcess = [
  {
    src: 'roberto-nickson-pGba3ewXzaM-unsplash.jpg',
    baseName: 'hero-1',
  },
  {
    src: 'Gemini_Generated_Image_1c204e1c204e1c20.jpeg',
    baseName: 'hero-2',
  },
];

async function optimize() {
  console.log('Optimizing images with sharp...');
  
  for (const item of imagesToProcess) {
    const srcPath = path.join(mediaDir, item.src);
    if (!fs.existsSync(srcPath)) {
      console.warn(`Source image not found: ${srcPath}`);
      continue;
    }

    console.log(`Processing ${item.src} -> ${item.baseName}...`);

    // 1. Base clean copy
    await sharp(srcPath)
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(path.join(outDir, `${item.baseName}.jpg`));

    // 2. 1920px WebP (Hero)
    await sharp(srcPath)
      .resize({ width: 1920, withoutEnlargement: false })
      .webp({ quality: 80 })
      .toFile(path.join(outDir, `${item.baseName}-1920.webp`));

    // 3. 1920px JPEG fallback (Hero)
    await sharp(srcPath)
      .resize({ width: 1920, withoutEnlargement: false })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(outDir, `${item.baseName}-1920.jpg`));

    // 4. 800px WebP (Cards/Thumbnails)
    await sharp(srcPath)
      .resize({ width: 800, withoutEnlargement: false })
      .webp({ quality: 80 })
      .toFile(path.join(outDir, `${item.baseName}-800.webp`));

    // 5. 800px JPEG fallback (Cards/Thumbnails)
    await sharp(srcPath)
      .resize({ width: 800, withoutEnlargement: false })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(path.join(outDir, `${item.baseName}-800.jpg`));

    console.log(`Generated all formats for ${item.baseName}`);
  }

  console.log('Image optimization complete.');
}

optimize().catch((err) => {
  console.error('Image optimization failed:', err);
  process.exit(1);
});
