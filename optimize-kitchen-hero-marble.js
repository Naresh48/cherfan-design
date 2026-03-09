const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, 'assets', 'website');
const outputDir = path.join(__dirname, 'assets', 'final-pics');
const sizes = [400, 800, 1200, 1600];

const filesToProcess = [
  { filename: 'kitchen-homeman.png', baseName: 'kitchen-homeman' },
  { filename: 'kitchen-marble.png', baseName: 'kitchen-marble' }
];

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function processImage(entry) {
  const inputPath = path.join(inputDir, entry.filename);
  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  Skipping, file not found: ${inputPath}`);
    return;
  }

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    for (const size of sizes) {
      let width = size;
      let height = null;

      if (metadata.width && metadata.height) {
        const aspectRatio = metadata.width / metadata.height;
        if (metadata.width > metadata.height) {
          width = size;
          height = Math.round(size / aspectRatio);
        } else {
          height = size;
          width = Math.round(size * aspectRatio);
        }
      }

      // AVIF
      const avifPath = path.join(outputDir, `${entry.baseName}-${size}.avif`);
      await image
        .clone()
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .avif({ quality: 80 })
        .toFile(avifPath);

      // WebP
      const webpPath = path.join(outputDir, `${entry.baseName}-${size}.webp`);
      await image
        .clone()
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(webpPath);

      console.log(`✓ ${entry.filename} → ${entry.baseName}-${size} (AVIF/WebP)`);
    }
  } catch (err) {
    console.error(`❌ Error processing ${entry.filename}:`, err);
  }
}

async function main() {
  console.log('🚀 Optimizing kitchen-homeman and kitchen-marble photos...\n');
  
  for (const entry of filesToProcess) {
    await processImage(entry);
  }
  
  console.log('\n✅ Kitchen hero and marble photos optimized into assets/final-pics');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

