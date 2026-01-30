const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const inputDir = path.join(__dirname, 'assets', 'kitchen-project');
const outputDir = path.join(__dirname, 'assets', 'optimized', 'images', 'kitchen-project-processed');
const sizes = [400, 800, 1200, 1600];

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get all image files from input directory
const imageFiles = fs.readdirSync(inputDir).filter(file => {
  const ext = path.extname(file).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
});

console.log(`Found ${imageFiles.length} images to process...\n`);

// Process each image
async function processImage(filename) {
  const inputPath = path.join(inputDir, filename);
  // Normalize filename: convert to lowercase and replace spaces/hyphens
  const baseName = path.basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-');
  
  console.log(`Processing: ${filename} -> ${baseName}`);
  
  try {
    // Read the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Process each size
    for (const size of sizes) {
      // Calculate dimensions while maintaining aspect ratio
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
      
      // Generate AVIF
      const avifPath = path.join(outputDir, `${baseName}-${size}.avif`);
      await image
        .clone()
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .avif({ quality: 80 })
        .toFile(avifPath);
      
      // Generate WebP
      const webpPath = path.join(outputDir, `${baseName}-${size}.webp`);
      await image
        .clone()
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({ quality: 85 })
        .toFile(webpPath);
      
      console.log(`  ✓ Created ${size}px versions (AVIF & WebP)`);
    }
    
    console.log(`✓ Completed: ${filename}\n`);
  } catch (error) {
    console.error(`✗ Error processing ${filename}:`, error.message);
  }
}

// Process all images
async function processAllImages() {
  for (const file of imageFiles) {
    await processImage(file);
  }
  
  console.log(`\n✅ All images processed!`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`Total files created: ${imageFiles.length * sizes.length * 2} (${imageFiles.length} images × ${sizes.length} sizes × 2 formats)`);
}

// Run the processing
processAllImages().catch(console.error);

