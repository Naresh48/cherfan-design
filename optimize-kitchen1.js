const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, 'assets', 'website', 'Kitchen1');
const outputDir = path.join(__dirname, 'assets', 'final-pics', 'kitchen1');
const sizes = [400, 800, 1200, 1600];

// Get all image files from Kitchen1 folder
const files = fs.readdirSync(inputDir).filter(file => {
  const ext = path.extname(file).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'].includes(ext);
}).sort(); // Sort to ensure consistent order

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function processImage(filename) {
  const inputPath = path.join(inputDir, filename);
  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  Skipping, file not found: ${inputPath}`);
    return null;
  }

  // Create base name from filename (remove extension, convert to lowercase, replace spaces/special chars with hyphens)
  const baseName = path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

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
      const avifPath = path.join(outputDir, `${baseName}-${size}.avif`);
      await image
        .clone()
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .avif({ quality: 80 })
        .toFile(avifPath);

      // WebP
      const webpPath = path.join(outputDir, `${baseName}-${size}.webp`);
      await image
        .clone()
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(webpPath);

      console.log(`✓ ${filename} → ${baseName}-${size} (AVIF/WebP)`);
    }

    return baseName;
  } catch (err) {
    console.error(`❌ Error processing ${filename}:`, err);
    return null;
  }
}

async function main() {
  console.log(`📁 Processing ${files.length} images from Kitchen1...\n`);
  
  const processedFiles = [];
  for (const file of files) {
    const baseName = await processImage(file);
    if (baseName) {
      processedFiles.push({ filename: file, baseName });
    }
  }
  
  console.log(`\n✅ Kitchen1 photos optimized into assets/final-pics/kitchen1`);
  console.log(`\n📋 Processed files:`);
  processedFiles.forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.filename} → ${f.baseName}`);
  });
}

main().catch((err) => {
  console.error('Unexpected error in optimize-kitchen1:', err);
  process.exit(1);
});

