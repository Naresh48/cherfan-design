#!/usr/bin/env node
/**
 * Optimize CMS-uploaded images to assets/final-pics/cms
 *
 * - Processes images from Cloudinary (or other https URLs), Uploadcare-style URLs, or assets/uploads
 * - Outputs 400, 800, 1200, 1600 in AVIF and WebP to assets/final-pics/cms/
 * - Updates content JSON to use optimized base paths (e.g. "cms/abc123")
 * - Removes originals from assets/uploads (no unoptimized images in repo)
 *
 * Run: npm run optimize-assets
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const SIZES = [400, 800, 1200, 1600];
const CMS_OUTPUT_DIR = path.join(__dirname, 'assets', 'final-pics', 'cms');
const FINAL_PICS_DIR = path.join(__dirname, 'assets', 'final-pics');
const NEW_ASSETS_DIR = path.join(__dirname, 'assets', 'new');
const UPLOADS_DIR = path.join(__dirname, 'assets', 'uploads');
const CONTENT_DIR = path.join(__dirname, 'content');

function isImageUrl(val) {
  if (typeof val !== 'string') return false;
  return (
    val.startsWith('https://') ||
    val.startsWith('http://') ||
    (val.startsWith('/') && val.includes('uploads')) ||
    val.startsWith('assets/uploads')
  );
}

/**
 * Derive stable file base from Cloudinary delivery URL (res.cloudinary.com/.../upload/...)
 */
function extractCloudinaryBase(url) {
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/\/upload\/(.+)$/i);
    if (!m) return null;
    const segments = m[1].split('/').filter(Boolean);
    let i = 0;
    while (i < segments.length) {
      const s = segments[i];
      if (/^v\d+$/i.test(s)) {
        i++;
        continue;
      }
      if (s.includes(',') || /^[a-z]{1,3}_[a-z0-9,_-]+$/i.test(s)) {
        i++;
        continue;
      }
      break;
    }
    let id = segments.slice(i).join('/');
    if (!id) return null;
    id = id.replace(/\.(jpe?g|png|webp|avif|gif|svg)$/i, '');
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 45);
    return safe.length > 2 ? safe : null;
  } catch {
    return null;
  }
}

function extractBaseName(urlOrPath) {
  if (urlOrPath.includes('res.cloudinary.com') || urlOrPath.includes('cloudinary.com')) {
    const fromCloud = extractCloudinaryBase(urlOrPath);
    if (fromCloud) return fromCloud;
    return 'cl_' + crypto.createHash('md5').update(urlOrPath).digest('hex').slice(0, 12);
  }
  if (urlOrPath.includes('ucarecdn.com')) {
    const match = urlOrPath.match(/\/([a-f0-9-]+)(?:\/|$)/i);
    return match ? match[1].replace(/-/g, '').slice(0, 16) : crypto.createHash('md5').update(urlOrPath).digest('hex').slice(0, 12);
  }
  const basename = path.basename(urlOrPath);
  return path.basename(basename, path.extname(basename)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

function collectImageValues(obj, out = new Set()) {
  if (!obj) return out;
  if (typeof obj === 'string' && isImageUrl(obj)) {
    out.add(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v) => collectImageValues(v, out));
    return out;
  }
  if (typeof obj === 'object') {
    Object.values(obj).forEach((v) => collectImageValues(v, out));
  }
  return out;
}

function replaceImageValues(obj, replacements) {
  if (!obj) return obj;
  if (typeof obj === 'string' && replacements.has(obj)) {
    return replacements.get(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((v) => replaceImageValues(v, replacements));
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = replaceImageValues(v, replacements);
    }
    return result;
  }
  return obj;
}

async function getImageBuffer(src) {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`);
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }
  const localPath = path.isAbsolute(src)
    ? path.join(__dirname, src.replace(/^\//, ''))
    : path.join(__dirname, src);
  return fs.promises.readFile(localPath);
}

async function optimizeImage(inputBuffer, baseName) {
  await fs.promises.mkdir(CMS_OUTPUT_DIR, { recursive: true });

  const meta = await sharp(inputBuffer).metadata();
  const maxDim = Math.max(meta.width || 0, meta.height || 0);

  const tasks = [];
  for (const w of SIZES) {
    if (w > maxDim && maxDim > 0) continue;
    // Auto-apply EXIF orientation before resize/output
    const resize = sharp(inputBuffer).rotate().resize({ width: w, withoutEnlargement: true });
    tasks.push(
      resize.clone().avif({ quality: 80 }).toFile(path.join(CMS_OUTPUT_DIR, `${baseName}-${w}.avif`)),
      resize.clone().webp({ quality: 85 }).toFile(path.join(CMS_OUTPUT_DIR, `${baseName}-${w}.webp`))
    );
  }
  await Promise.all(tasks);
}

async function optimizeLocalAssetsNew() {
  if (!fs.existsSync(NEW_ASSETS_DIR)) return 0;
  await fs.promises.mkdir(FINAL_PICS_DIR, { recursive: true });

  const entries = await fs.promises.readdir(NEW_ASSETS_DIR);
  const files = entries
    .filter((f) => !f.startsWith('.'))
    .filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));

  let processed = 0;
  for (const file of files) {
    const inputPath = path.join(NEW_ASSETS_DIR, file);
    const baseName = path.basename(file, path.extname(file)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const inputBuffer = await fs.promises.readFile(inputPath);

    const meta = await sharp(inputBuffer).metadata();
    const maxDim = Math.max(meta.width || 0, meta.height || 0);

    const tasks = [];
    for (const w of SIZES) {
      if (w > maxDim && maxDim > 0) continue;
      // Auto-apply EXIF orientation before resize/output
      const resize = sharp(inputBuffer).rotate().resize({ width: w, withoutEnlargement: true });
      tasks.push(
        resize.clone().avif({ quality: 80 }).toFile(path.join(FINAL_PICS_DIR, `${baseName}-${w}.avif`)),
        resize.clone().webp({ quality: 85 }).toFile(path.join(FINAL_PICS_DIR, `${baseName}-${w}.webp`))
      );
    }
    await Promise.all(tasks);
    processed++;
  }
  return processed;
}

async function main() {
  const contentFiles = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'));

  // 1. Collect all image URLs from all content files
  const allUrls = new Set();
  for (const file of contentFiles) {
    const filePath = path.join(CONTENT_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      collectImageValues(data, allUrls);
    } catch {
      /* skip */
    }
  }

  const replacements = new Map();
  const toDelete = [];

  // 2. Process each URL: fetch/read, optimize, record replacement and any local file to delete
  for (const url of allUrls) {
    try {
      const buffer = await getImageBuffer(url);
      const baseName = extractBaseName(url);
      await optimizeImage(buffer, baseName);
      replacements.set(url, `cms/${baseName}`);

      const relPath = url.replace(/^\//, '');
      const localPath = path.join(__dirname, relPath);
      if ((url.includes('uploads') || relPath.startsWith('assets/uploads')) && fs.existsSync(localPath)) {
        toDelete.push(localPath);
      }
    } catch (err) {
      console.warn(`[optimize-assets] Skip ${url.slice(0, 60)}...:`, err.message);
    }
  }

  // 3. Update content files with replacements
  for (const file of contentFiles) {
    const filePath = path.join(CONTENT_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }
    const updated = replaceImageValues(data, replacements);
    if (JSON.stringify(data) !== JSON.stringify(updated)) {
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    }
  }

  // 4. Remove originals from assets/uploads
  for (const p of toDelete) {
    try {
      fs.unlinkSync(p);
      console.log('[optimize-assets] Removed original:', path.relative(__dirname, p));
    } catch (e) {
      console.warn('[optimize-assets] Could not remove:', p, e.message);
    }
  }

  if (replacements.size > 0) {
    console.log('[optimize-assets] Processed', replacements.size, 'image(s) → assets/final-pics/cms/');
  }

  const localProcessed = await optimizeLocalAssetsNew();
  if (localProcessed > 0) {
    console.log('[optimize-assets] Processed', localProcessed, 'local image(s) → assets/final-pics/');
  }
}

main().catch((err) => {
  console.error('[optimize-assets]', err);
  process.exit(1);
});
