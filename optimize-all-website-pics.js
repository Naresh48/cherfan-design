const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputBaseDir = path.join(__dirname, 'assets', 'website');
const outputBaseDir = path.join(__dirname, 'assets', 'final-pics');
const sizes = [400, 800, 1200, 1600];

// Folders to process (skip Kitchen1 as it's already done)
const foldersToProcess = [
  { input: 'Kitchen2', output: 'kitchen2' },
  { input: 'Kitchen3', output: 'kitchen3' },
  { input: 'Kitchen4', output: 'kitchen4' },
  { input: 'kitchen5', output: 'kitchen5' },
  { input: 'kitchen6', output: 'kitchen6' },
  { input: 'kitchen7', output: 'kitchen7' },
  { input: 'kitchen8', output: 'kitchen8' },
  { input: 'kid1', output: 'kid1' },
  { input: 'kid2', output: 'kid2' },
  { input: 'kid3', output: 'kid3' },
  { input: 'Kid4', output: 'kid4' }
];

function sanitizeBaseName(filename) {
  return path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function processImage(inputPath, outputDir, baseName) {
  if (!fs.existsSync(inputPath)) {
    console.warn(`⚠️  Skipping, file not found: ${inputPath}`);
    return false;
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
    }

    return true;
  } catch (err) {
    console.error(`❌ Error processing ${inputPath}:`, err.message);
    return false;
  }
}

async function processFolder(folderConfig) {
  const inputDir = path.join(inputBaseDir, folderConfig.input);
  const outputDir = path.join(outputBaseDir, folderConfig.output);

  if (!fs.existsSync(inputDir)) {
    console.warn(`⚠️  Skipping, folder not found: ${inputDir}`);
    return { folder: folderConfig.output, files: [], skipped: true };
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get all image files
  const files = fs.readdirSync(inputDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'].includes(ext);
  }).sort();

  console.log(`\n📁 Processing ${folderConfig.input} (${files.length} images)...`);

  const processedFiles = [];
  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const baseName = sanitizeBaseName(file);
    
    const success = await processImage(inputPath, outputDir, baseName);
    if (success) {
      processedFiles.push({ filename: file, baseName });
      console.log(`  ✓ ${file} → ${baseName}`);
    }
  }

  return { folder: folderConfig.output, files: processedFiles, skipped: false };
}

async function main() {
  console.log('🚀 Starting optimization of all website photos...\n');
  console.log(`📂 Input: ${inputBaseDir}`);
  console.log(`📂 Output: ${outputBaseDir}\n`);

  const results = [];
  for (const folderConfig of foldersToProcess) {
    const result = await processFolder(folderConfig);
    results.push(result);
  }

  console.log('\n\n✅ Optimization complete!\n');
  console.log('📋 Summary:');
  results.forEach(result => {
    if (result.skipped) {
      console.log(`  ⚠️  ${result.folder}: Skipped (folder not found)`);
    } else {
      console.log(`  ✓ ${result.folder}: ${result.files.length} images processed`);
    }
  });
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

