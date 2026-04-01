/**
 * Content Loader for Decap CMS Integration
 * 
 * This script loads JSON content files and injects them into HTML elements
 * without modifying layout, styles, or existing functionality.
 * 
 * Fails silently if JSON files are missing to maintain backward compatibility.
 */

(function contentLoader() {
  'use strict';

  /**
   * Check if value is a full URL (Cloudinary, other CDN, or uploads) vs imageBase
   */
  function isFullImageUrl(value) {
    if (!value || typeof value !== 'string') return false;
    return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
  }

  /**
   * Helper: Generate optimized image paths from base name
   * - cms/xxx → assets/final-pics/cms/xxx (CMS-uploaded, optimized by build)
   * - else → assets/optimized/images/xxx (existing structure)
   * Returns null for full URLs (handled separately)
   */
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
        400: `${basePath}-400.avif`
      },
      webp: {
        1600: `${basePath}-1600.webp`,
        1200: `${basePath}-1200.webp`,
        800: `${basePath}-800.webp`,
        400: `${basePath}-400.webp`
      },
      fallback: `${basePath}-800.webp`
    };
  }

  /**
   * Helper: Update picture element with new image paths
   * Handles both imageBase (optimized) and full URLs (Cloudinary, /assets/uploads, etc.)
   */
  function updatePictureElement(pictureEl, imageBase) {
    if (!pictureEl || !imageBase) return;
    
    // Full URL: use as single image (before build optimization runs)
    if (isFullImageUrl(imageBase)) {
      const img = pictureEl.querySelector('img');
      const avifSource = pictureEl.querySelector('source[type="image/avif"]');
      const webpSource = pictureEl.querySelector('source[type="image/webp"]');
      // Use single URL for all - hide sources if present, or set img only
      if (img) img.src = imageBase;
      if (avifSource) avifSource.srcset = imageBase;
      if (webpSource) webpSource.srcset = imageBase;
      return;
    }

    const paths = getImagePaths(imageBase);
    if (!paths) return;

    // Update AVIF source
    const avifSource = pictureEl.querySelector('source[type="image/avif"]');
    if (avifSource) {
      avifSource.srcset = `${paths.avif[1600]} 1600w, ${paths.avif[1200]} 1200w, ${paths.avif[800]} 800w, ${paths.avif[400]} 400w`;
    }

    // Update WebP source
    const webpSource = pictureEl.querySelector('source[type="image/webp"]');
    if (webpSource) {
      webpSource.srcset = `${paths.webp[1600]} 1600w, ${paths.webp[1200]} 1200w, ${paths.webp[800]} 800w, ${paths.webp[400]} 400w`;
    }

    // Update img fallback
    const img = pictureEl.querySelector('img');
    if (img) {
      img.src = paths.fallback;
    }
  }

  /**
   * Helper: Get nested value from object using dot notation path
   */
  function getNestedValue(obj, path) {
    if (!obj || !path) return null;
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      // Handle array notation like "cards[0]"
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

  /**
   * Helper: Set text content safely
   */
  function setTextContent(element, text) {
    if (element && text !== undefined && text !== null) {
      // Convert to string and trim whitespace
      const textValue = String(text).trim();
      if (textValue) {
        element.textContent = textValue;
      }
    }
  }

  /**
   * Helper: Set HTML content for footer contact (preserves <br> tags)
   */
  function setHTMLContent(element, html) {
    if (element && html !== undefined && html !== null) {
      element.innerHTML = html;
    }
  }

  /**
   * Helper: Set attribute content safely
   */
  function setAttributeContent(element, attribute, value) {
    if (element && attribute && value !== undefined && value !== null) {
      const textValue = String(value).trim();
      if (textValue) {
        element.setAttribute(attribute, textValue);
      }
    }
  }

  /**
   * Helper: apply value to selector.
   * mode "text" updates textContent, otherwise sets attribute with mode name.
   */
  function applySelectorValue(root, selector, path, data, mode = 'text') {
    const element = root.querySelector(selector);
    if (!element) return;
    const value = getNestedValue(data, path);
    if (value === null || value === undefined) return;

    if (mode === 'text') {
      setTextContent(element, value);
      return;
    }
    if (mode === 'html') {
      setHTMLContent(element, value);
      return;
    }
    setAttributeContent(element, mode, value);
  }

  /**
   * Inject text into static selectors that do not use data-content.
   */
  function injectSelectorContent(data, pageName) {
    const root = document;

    const globalBindings = [
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
      ['#contactModal .mb-4 p:nth-child(1)', 'common.contactModal.contactLabel'],
      ['#contactModal .mb-4 p:nth-child(2)', 'common.contactModal.emailLabel'],
      ['#contactModal .mb-4 p:nth-child(3)', 'common.contactModal.locationLabel'],
      ['#contactForm > div:nth-of-type(1) > label', 'common.contactModal.firstNameLabel'],
      ['#errFirst', 'common.contactModal.firstNameError'],
      ['#contactForm > div:nth-of-type(2) > label', 'common.contactModal.lastNameLabel'],
      ['#errLast', 'common.contactModal.lastNameError'],
      ['#contactForm > div:nth-of-type(3) > label', 'common.contactModal.emailFieldLabel'],
      ['#errEmail', 'common.contactModal.emailError'],
      ['#contactForm > div:nth-of-type(4) > label', 'common.contactModal.subjectLabel'],
      ['#errSubject', 'common.contactModal.subjectError'],
      ['#contactForm > div:nth-of-type(5) > label', 'common.contactModal.notesLabel'],
      ['#contactForm button[type="submit"]', 'common.contactModal.submitButton']
    ];

    globalBindings.forEach(([selector, path, mode]) => {
      applySelectorValue(root, selector, path, data, mode || 'text');
    });

    const contactValueLines = [
      ['#contactModal .mb-4 p:nth-child(1)', 'common.contactModal.contactLabel', 'common.contactModal.contactValue'],
      ['#contactModal .mb-4 p:nth-child(2)', 'common.contactModal.emailLabel', 'common.contactModal.emailValue'],
      ['#contactModal .mb-4 p:nth-child(3)', 'common.contactModal.locationLabel', 'common.contactModal.locationValue']
    ];
    contactValueLines.forEach(([selector, labelPath, valuePath]) => {
      const element = root.querySelector(selector);
      const label = getNestedValue(data, labelPath);
      const value = getNestedValue(data, valuePath);
      if (element && label && value) {
        setHTMLContent(element, `<span class="font-medium">${label}</span> ${value}`);
      }
    });

    if (pageName === 'about-us') {
      const aboutBindings = [
        ['#heroSection h1', 'heroSection.title'],
        ['#heroSection p', 'heroSection.subtitle'],
        ['section:nth-of-type(2) .max-w-4xl > p', 'storySection.label'],
        ['section:nth-of-type(2) .max-w-4xl > h2', 'storySection.title'],
        ['section:nth-of-type(2) .max-w-4xl .space-y-6 p:nth-child(1)', 'storySection.paragraph1'],
        ['section:nth-of-type(2) .max-w-4xl .space-y-6 p:nth-child(2)', 'storySection.paragraph2'],
        ['section:nth-of-type(2) .max-w-4xl .space-y-6 p:nth-child(3)', 'storySection.paragraph3'],
        ['section:nth-of-type(3) .grid > div:nth-child(2) > p', 'philosophySection.label'],
        ['section:nth-of-type(3) .grid > div:nth-child(2) > h2', 'philosophySection.title'],
        ['section:nth-of-type(3) .grid > div:nth-child(2) > p:nth-of-type(2)', 'philosophySection.paragraph1'],
        ['section:nth-of-type(3) .grid > div:nth-child(2) > p:nth-of-type(3)', 'philosophySection.paragraph2'],
        ['section:nth-of-type(4) .text-center > p', 'valuesSection.label'],
        ['section:nth-of-type(4) .text-center > h2', 'valuesSection.title'],
        ['section:nth-of-type(4) .grid > div:nth-child(1) h3', 'valuesSection.cards[0].title'],
        ['section:nth-of-type(4) .grid > div:nth-child(1) p', 'valuesSection.cards[0].description'],
        ['section:nth-of-type(4) .grid > div:nth-child(2) h3', 'valuesSection.cards[1].title'],
        ['section:nth-of-type(4) .grid > div:nth-child(2) p', 'valuesSection.cards[1].description'],
        ['section:nth-of-type(4) .grid > div:nth-child(3) h3', 'valuesSection.cards[2].title'],
        ['section:nth-of-type(4) .grid > div:nth-child(3) p', 'valuesSection.cards[2].description'],
        ['section:nth-of-type(5) .max-w-3xl h2', 'finalSection.title'],
        ['section:nth-of-type(5) .max-w-3xl p:nth-of-type(1)', 'finalSection.paragraph1'],
        ['section:nth-of-type(5) .max-w-3xl p:nth-of-type(2)', 'finalSection.paragraph2']
      ];

      aboutBindings.forEach(([selector, path]) => {
        applySelectorValue(root, selector, path, data, 'text');
      });
    }
  }

  /**
   * Load and inject content for a specific page
   */
  function fetchJSON(jsonPath) {
    const timestamp = new Date().getTime();
    const url = `${jsonPath}?t=${timestamp}`;
    return fetch(url, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load ${jsonPath}`);
        }
        return response.json();
      });
  }

  function loadPageContent(pageName) {
    const pageJsonPath = `content/${pageName}.json`;
    const commonJsonPath = 'content/common.json';

    Promise.allSettled([fetchJSON(pageJsonPath), fetchJSON(commonJsonPath)])
      .then(([pageResult, commonResult]) => {
        const pageData = pageResult.status === 'fulfilled' ? pageResult.value : null;
        const commonData = commonResult.status === 'fulfilled' ? commonResult.value : null;

        if (!pageData) {
          console.error(`Content loader: Could not load ${pageJsonPath}`, pageResult.reason);
        } else {
          console.log(`Content loader: Successfully loaded ${pageJsonPath}`, pageData);
        }

        if (!commonData) {
          console.error(`Content loader: Could not load ${commonJsonPath}`, commonResult.reason);
        }

        if (!pageData && !commonData) return;

        const mergedData = pageData || {};
        if (commonData) {
          mergedData.common = commonData;
        }

        injectContent(mergedData);
        injectSelectorContent(mergedData, pageName);
      })
      .catch(error => {
        console.error('Content loader: Unexpected loading error', error);
      });
  }

  /**
   * Inject content into HTML elements using data attributes
   */
  function injectContent(data) {
    if (!data) {
      console.warn('Content loader: No data provided to injectContent');
      return;
    }

    // Process all elements with data-content attribute
    const elements = document.querySelectorAll('[data-content]');
    console.log(`Content loader: Found ${elements.length} elements with data-content attribute`);
    
    if (elements.length === 0) {
      console.warn('Content loader: No elements with data-content attribute found. Page may not be fully loaded.');
      return;
    }
    
    let updatedCount = 0;
    elements.forEach(element => {
      const path = element.getAttribute('data-content');
      const value = getNestedValue(data, path);
      if (value !== null && value !== undefined) {
        // Special handling for footer contact (needs HTML)
        if (path === 'footer.contact') {
          const contact = data.footer?.contact;
          if (contact) {
            setHTMLContent(element, `${contact.address}<br>${contact.phone}<br>${contact.email}`);
            updatedCount++;
          }
        } else {
          setTextContent(element, value);
          updatedCount++;
        }
      } else {
        console.warn(`Content loader: No value found for path: ${path}`);
      }
    });
    
    console.log(`Content loader: Updated ${updatedCount} out of ${elements.length} elements`);

    // Process all picture elements with data-image attribute
    document.querySelectorAll('picture[data-image]').forEach(pictureEl => {
      const path = pictureEl.getAttribute('data-image');
      const imageBase = getNestedValue(data, path);
      if (imageBase) {
        updatePictureElement(pictureEl, imageBase);
      }
    });

    // Special handling for project titles (kitchen page)
    if (data.projects && Array.isArray(data.projects)) {
      const projectItems = document.querySelectorAll('.project-item');
      projectItems.forEach((item, index) => {
        if (data.projects[index]) {
          const titleEl = item.querySelector('h4');
          if (titleEl && !titleEl.hasAttribute('data-content')) {
            setTextContent(titleEl, data.projects[index].title);
          }
        }
      });
    }
  }

  /**
   * Determine current page and load appropriate content
   */
  function init() {
    // First, check for data-page attribute on body tag (most reliable)
    const body = document.body;
    let pageName = body ? body.getAttribute('data-page') : null;
    
    if (pageName) {
      console.log('Content loader: Detected page from data-page attribute:', pageName);
    } else {
      // Fallback to URL detection
      let path = window.location.pathname;
      
      // Remove leading/trailing slashes and get the filename
      path = path.replace(/^\/+|\/+$/g, '');
      const page = path.split('/').pop() || 'index.html';
      
      // Also check window.location.href as fallback
      const href = window.location.href;
      const hrefPage = href.split('/').pop().split('?')[0].split('#')[0];
      
      // Determine page name
      pageName = 'home';
      const currentPage = page || hrefPage || 'index.html';
      
      console.log('Content loader: Detected page from URL:', currentPage, 'from path:', path);
      
      if (currentPage === 'index.html' || currentPage === '' || currentPage === '/' || !currentPage) {
        pageName = 'home';
      } else if (currentPage === 'kitchen.html' || currentPage.includes('kitchen')) {
        pageName = 'kitchen';
      } else if (currentPage === 'master-bedroom.html' || currentPage.includes('master-bedroom')) {
        pageName = 'master-bedroom';
      } else if (currentPage === 'closet.html' || currentPage.includes('closet')) {
        pageName = 'closet';
      } else if (currentPage === 'kids-bedroom.html' || currentPage.includes('kids-bedroom')) {
        pageName = 'kids';
      } else if (currentPage === 'about-us.html' || currentPage.includes('about-us')) {
        pageName = 'about-us';
      }
    }
    
    console.log('Content loader: Loading content for page:', pageName);

    // Load content when DOM is ready
    // Track if content has been loaded to avoid duplicate loads
    let contentLoaded = false;
    
    function loadContent() {
      if (contentLoaded) return;
      
      // Wait a bit longer to ensure all scripts have run
      setTimeout(() => {
        if (!contentLoaded) {
          loadPageContent(pageName);
          contentLoaded = true;
        }
      }, 300);
    }
    
    // Try multiple strategies to ensure content loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadContent);
      // Also try on window load as backup
      window.addEventListener('load', () => {
        if (!contentLoaded) {
          setTimeout(() => {
            loadPageContent(pageName);
            contentLoaded = true;
          }, 100);
        }
      });
    } else if (document.readyState === 'interactive') {
      // DOM is ready but resources may still be loading
      loadContent();
      window.addEventListener('load', () => {
        if (!contentLoaded) {
          setTimeout(() => {
            loadPageContent(pageName);
            contentLoaded = true;
          }, 100);
        }
      });
    } else {
      // DOM is fully loaded
      loadContent();
    }
  }

  // Initialize
  init();
})();
