#!/usr/bin/env node
/**
 * Bake Decap CMS content into static HTML at build time.
 *
 * WHY: content-loader.js swaps images/text asynchronously (~300ms+ after
 * paint), so visitors first see the old hardcoded fallback, then a visible
 * flash when the CMS-chosen image loads. Baking writes the JSON values
 * into the HTML files during the Netlify build, so first paint is already
 * correct. content-loader.js stays as a runtime fallback (values match, so
 * no visible swap).
 *
 * This script mirrors content-loader.js + the per-page inline gallery
 * scripts EXACTLY (same resolvers, same skip-empty rules). If you change a
 * resolver in the browser code, update it here too.
 *
 * Run AFTER optimize-assets (needs final cms/ paths):
 *   npm run optimize-assets && npm run bake-content
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content');

// Page HTML file -> content JSON name (mirrors content-loader page detection)
const PAGES = {
  'index.html': 'home',
  'kitchen.html': 'kitchen',
  'master-bedroom.html': 'master-bedroom',
  'closet.html': 'closet',
  'kids-bedroom.html': 'kids',
  'about-us.html': 'about-us',
};

/* ---------- shared resolvers (mirror content-loader.js) ---------- */

function isFullImageUrl(value) {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

function getImagePaths(imageBase) {
  if (!imageBase || isFullImageUrl(imageBase)) return null;
  const basePath = imageBase.startsWith('cms/')
    ? `assets/final-pics/${imageBase}`
    : `assets/optimized/images/${imageBase}`;
  return {
    avif: {
      1600: `${basePath}-1600.avif`,
      1200: `${basePath}-1200.avif`,
      800: `${basePath}-800.avif`,
      400: `${basePath}-400.avif`,
    },
    webp: {
      1600: `${basePath}-1600.webp`,
      1200: `${basePath}-1200.webp`,
      800: `${basePath}-800.webp`,
      400: `${basePath}-400.webp`,
    },
    fallback: `${basePath}-800.webp`,
  };
}

function getNestedValue(obj, pathStr) {
  if (!obj || !pathStr) return null;
  const parts = pathStr.split('.');
  let value = obj;
  for (const part of parts) {
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const key = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      if (value[key] && Array.isArray(value[key]) && value[key][index] !== undefined) {
        value = value[key][index];
      } else {
        return null;
      }
    } else {
      if (value[part] !== undefined) {
        value = value[part];
      } else {
        return null;
      }
    }
  }
  return value;
}

function nonEmptyText(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/** Mirror of content-loader updatePictureElement(). Returns true if changed. */
function bakePicture($, pictureEl, imageBase) {
  const pic = $(pictureEl);
  let changed = false;
  if (isFullImageUrl(imageBase)) {
    const img = pic.find('img').first();
    const avifSource = pic.find('source[type="image/avif"]').first();
    const webpSource = pic.find('source[type="image/webp"]').first();
    if (img.length && img.attr('src') !== imageBase) { img.attr('src', imageBase); changed = true; }
    if (avifSource.length && avifSource.attr('srcset') !== imageBase) { avifSource.attr('srcset', imageBase); changed = true; }
    if (webpSource.length && webpSource.attr('srcset') !== imageBase) { webpSource.attr('srcset', imageBase); changed = true; }
    return changed;
  }
  const paths = getImagePaths(imageBase);
  if (!paths) return false;
  const avifSrcset = `${paths.avif[1600]} 1600w, ${paths.avif[1200]} 1200w, ${paths.avif[800]} 800w, ${paths.avif[400]} 400w`;
  const webpSrcset = `${paths.webp[1600]} 1600w, ${paths.webp[1200]} 1200w, ${paths.webp[800]} 800w, ${paths.webp[400]} 400w`;
  const avifSource = pic.find('source[type="image/avif"]').first();
  const webpSource = pic.find('source[type="image/webp"]').first();
  const img = pic.find('img').first();
  if (avifSource.length && avifSource.attr('srcset') !== avifSrcset) { avifSource.attr('srcset', avifSrcset); changed = true; }
  if (webpSource.length && webpSource.attr('srcset') !== webpSrcset) { webpSource.attr('srcset', webpSrcset); changed = true; }
  if (img.length && img.attr('src') !== paths.fallback) { img.attr('src', paths.fallback); changed = true; }
  return changed;
}

/* ---------- global selector bindings (mirror injectSelectorContent) ---------- */

const GLOBAL_BINDINGS = [
  ['a[data-target="kitchen"]', 'common.nav.kitchen'],
  ['a[data-target="kids"]', 'common.nav.kidsBedroom'],
  ['a[data-target="master"]', 'common.nav.masterBedroom'],
  ['a[data-target="closet"]', 'common.nav.closet'],
  ['a[data-target="about"]', 'common.nav.aboutUs'],
  ['a[data-target="contact"]', 'common.nav.contact'],
  ['footer .max-w-\\[1200px\\] > div:nth-child(2) h4', 'common.footer.contactHeading'],
  ['footer .max-w-\\[1200px\\] > div:nth-child(2) p', 'common.footer.contactHtml', 'html'],
  ['footer .max-w-\\[1200px\\] > div:nth-child(3) h4', 'common.footer.newsletterHeading'],
  ['#newsletterEmail', 'common.footer.newsletterPlaceholder', 'placeholder'],
  ['#newsletterForm button[type="submit"]', 'common.footer.newsletterButton'],
  ['footer .text-center.text-xs.text-gray-600.pb-6', 'common.footer.copyright'],
  ['.contact-modal-close', 'common.contactModal.closeAria', 'aria-label'],
  ['.contact-modal-title:nth-of-type(1)', 'common.contactModal.titlePrimary'],
  ['.contact-modal-title:nth-of-type(2)', 'common.contactModal.titleSecondary'],
  // NOTE: the plain contact/email/location label bindings are intentionally
  // omitted here — CONTACT_VALUE_LINES below supersedes them with rich HTML
  // (mirrors runtime net effect; setting plain text first would churn every run).
  ['#contactForm > div:nth-of-type(1) > label', 'common.contactModal.firstNameLabel'],
  ['#errFirst', 'common.contactModal.firstNameError'],
  ['#contactForm > div:nth-of-type(2) > label', 'common.contactModal.lastNameLabel'],
  ['#errLast', 'common.contactModal.lastNameError'],
  ['#contactForm > div:nth-of-type(3) > label', 'common.contactModal.emailFieldLabel'],
  ['#errEmail', 'common.contactModal.emailError'],
  ['#contactForm > div:nth-of-type(4) > label', 'common.contactModal.subjectLabel'],
  ['#errSubject', 'common.contactModal.subjectError'],
  ['#contactForm > div:nth-of-type(5) > label', 'common.contactModal.notesLabel'],
  ['#contactForm button[type="submit"]', 'common.contactModal.submitButton'],
];

const CONTACT_VALUE_LINES = [
  ['#contactModal .mb-4 p:nth-child(1)', 'common.contactModal.contactLabel', 'common.contactModal.contactValue'],
  ['#contactModal .mb-4 p:nth-child(2)', 'common.contactModal.emailLabel', 'common.contactModal.emailValue'],
  ['#contactModal .mb-4 p:nth-child(3)', 'common.contactModal.locationLabel', 'common.contactModal.locationValue'],
];

/* ---------- index hero slider (mirror inline resolveSlide/buildSlides) ---------- */

function resolveSlide(base) {
  if (!base || typeof base !== 'string') return null;
  if (/^https?:\/\//i.test(base)) return { src: base, srcset: null };
  if (/^cms\//.test(base)) {
    const p = 'assets/final-pics/' + base;
    return { src: p + '-800.webp', srcset: p + '-400.webp 400w, ' + p + '-800.webp 800w, ' + p + '-1200.webp 1200w, ' + p + '-1600.webp 1600w' };
  }
  if (base.charAt(0) === '/' || /\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(base)) {
    return { src: base, srcset: null };
  }
  const full = 'assets/' + base.replace(/^\/+/, '');
  return { src: full + '-800.webp', srcset: full + '-400.webp 400w, ' + full + '-800.webp 800w, ' + full + '-1200.webp 1200w, ' + full + '-1600.webp 1600w' };
}

/* ---------- master/closet scroll gallery (mirror resolveScrollEntry) ---------- */

function resolveScrollEntry(value) {
  let v = value;
  if (v && typeof v === 'object') v = v.imageBase || v.image || v.src;
  if (!v || typeof v !== 'string') return null;
  if (/^https?:\/\//i.test(v) || v.charAt(0) === '/') return { single: v };
  const full = /^cms\//.test(v) ? 'assets/final-pics/' + v : 'assets/optimized/images/' + v;
  return {
    avif: full + '-400.avif 400w, ' + full + '-800.avif 800w, ' + full + '-1200.avif 1200w, ' + full + '-1600.avif 1600w',
    webp: full + '-400.webp 400w, ' + full + '-800.webp 800w, ' + full + '-1200.webp 1200w, ' + full + '-1600.webp 1600w',
    img: full + '-800.webp',
  };
}

/* ---------- main ---------- */

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function bakePage(htmlFile, pageName) {
  const htmlPath = path.join(ROOT, htmlFile);
  const pageData = loadJson(path.join(CONTENT_DIR, `${pageName}.json`));
  const commonData = loadJson(path.join(CONTENT_DIR, 'common.json'));
  if (!pageData && !commonData) {
    console.warn(`[bake-content] Skip ${htmlFile}: no JSON`);
    return false;
  }
  const data = pageData || {};
  if (commonData) data.common = commonData;

  const raw = fs.readFileSync(htmlPath, 'utf8');
  const $ = cheerio.load(raw, { decodeEntities: false });
  let changed = false;

  // 1. [data-content] text (mirror injectContent text pass)
  $('[data-content]').each((_, el) => {
    const attrPath = $(el).attr('data-content');
    const value = getNestedValue(data, attrPath);
    const text = nonEmptyText(value);
    if (text === null) return;
    if ($(el).text() !== text) { $(el).text(text); changed = true; }
  });

  // 2. picture[data-image] (mirror injectContent image pass)
  $('picture[data-image]').each((_, el) => {
    const attrPath = $(el).attr('data-image');
    const imageBase = getNestedValue(data, attrPath);
    if (imageBase) {
      if (bakePicture($, el, imageBase)) changed = true;
    }
  });

  // 3. project cover titles without data-content (mirror special-case)
  if (data.projects && Array.isArray(data.projects)) {
    $('.project-item').each((index, item) => {
      const proj = data.projects[index];
      if (!proj) return;
      const titleEl = $(item).find('h4').first();
      if (titleEl.length && !titleEl.is('[data-content]')) {
        const text = nonEmptyText(proj.title);
        if (text !== null && titleEl.text() !== text) { titleEl.text(text); changed = true; }
      }
    });
  }

  // 4. global selector bindings (mirror injectSelectorContent)
  for (const [selector, bindPath, mode] of GLOBAL_BINDINGS) {
    let el;
    try {
      el = $(selector).first();
    } catch {
      continue;
    }
    if (!el.length) continue;
    const value = getNestedValue(data, bindPath);
    if (value === null || value === undefined) continue;
    if (!mode || mode === 'text') {
      const text = nonEmptyText(value);
      if (text !== null && el.text() !== text) { el.text(text); changed = true; }
    } else if (mode === 'html') {
      if (el.html() !== String(value)) { el.html(String(value)); changed = true; }
    } else {
      const text = nonEmptyText(value);
      if (text !== null && el.attr(mode) !== text) { el.attr(mode, text); changed = true; }
    }
  }
  for (const [selector, labelPath, valuePath] of CONTACT_VALUE_LINES) {
    let el;
    try {
      el = $(selector).first();
    } catch {
      continue;
    }
    if (!el.length) continue;
    const label = getNestedValue(data, labelPath);
    const value = getNestedValue(data, valuePath);
    if (label && value) {
      const html = `<span class="font-medium">${label}</span> ${value}`;
      if (el.html() !== html) { el.html(html); changed = true; }
    } else if (label) {
      // Runtime fallback when the value is missing: plain label text.
      const text = nonEmptyText(label);
      if (text !== null && el.text() !== text) { el.text(text); changed = true; }
    }
  }

  // 5. index hero slider: rebuild track from JSON (mirror buildSlides)
  if (pageName === 'home') {
    const track = $('#heroSliderTrack');
    const imgs = data.heroSlider && data.heroSlider.images;
    if (track.length && imgs && imgs.length) {
      const slides = [];
      imgs.forEach((item, i) => {
        const r = resolveSlide(item && item.imageBase);
        if (!r) return;
        const alt = (item && item.alt) || ('Luxury interior ' + (i + 1));
        const loading = i < 1 ? 'eager' : 'lazy';
        const srcset = r.srcset ? ` srcset="${r.srcset}" sizes="100vw"` : '';
        slides.push(
          `<div class="hero-slide"><img src="${r.src}"${srcset} alt="${alt.replace(/"/g, '&quot;')}" loading="${loading}" decoding="async"></div>`
        );
      });
      if (slides.length) {
        const newHtml = '\n' + slides.join('\n') + '\n';
        const norm = (h) => (h || '').replace(/\s+/g, ' ').trim();
        if (norm(track.html()) !== norm(newHtml)) {
          track.html(newHtml);
          changed = true;
        }
        if (track.attr('data-original-count') !== undefined) {
          track.removeAttr('data-original-count');
          changed = true;
        }
      }
    }
  }

  // 6. master/closet scroll gallery covers (mirror inline updater)
  if (data.scrollGallery && Array.isArray(data.scrollGallery.images) && data.scrollGallery.images.length) {
    const list = data.scrollGallery.images;
    $('.horizontal-scroll-item').each((_, item) => {
      const idx = parseInt($(item).attr('data-image-index'), 10) || 0;
      const r = resolveScrollEntry(list[idx % list.length]);
      if (!r) return;
      const pic = $(item).find('picture').first();
      if (!pic.length) return;
      const avif = pic.find('source[type="image/avif"]').first();
      const webp = pic.find('source[type="image/webp"]').first();
      const img = pic.find('img').first();
      if (r.single) {
        if (img.length && img.attr('src') !== r.single) { img.attr('src', r.single); changed = true; }
        if (avif.length && avif.attr('srcset') !== r.single) { avif.attr('srcset', r.single); changed = true; }
        if (webp.length && webp.attr('srcset') !== r.single) { webp.attr('srcset', r.single); changed = true; }
      } else {
        if (avif.length && avif.attr('srcset') !== r.avif) { avif.attr('srcset', r.avif); changed = true; }
        if (webp.length && webp.attr('srcset') !== r.webp) { webp.attr('srcset', r.webp); changed = true; }
        if (img.length && img.attr('src') !== r.img) { img.attr('src', r.img); changed = true; }
      }
    });
  }

  if (changed) {
    fs.writeFileSync(htmlPath, $.html(), 'utf8');
    console.log(`[bake-content] Baked ${htmlFile}`);
  } else {
    console.log(`[bake-content] No changes for ${htmlFile}`);
  }
  return changed;
}

let files = 0;
for (const [htmlFile, pageName] of Object.entries(PAGES)) {
  try {
    if (bakePage(htmlFile, pageName)) files++;
  } catch (err) {
    console.error(`[bake-content] Failed ${htmlFile}:`, err.message);
  }
}
console.log(`[bake-content] Done, updated ${files} file(s)`);
