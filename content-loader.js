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
   * Helper: Generate optimized image paths from base name
   * Maintains existing AVIF/WebP structure
   */
  function getImagePaths(imageBase) {
    if (!imageBase) return null;
    
    const basePath = `assets/optimized/images/${imageBase}`;
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
   * Preserves all existing attributes and structure
   */
  function updatePictureElement(pictureEl, imageBase) {
    if (!pictureEl || !imageBase) return;
    
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
   * Load and inject content for a specific page
   */
  function loadPageContent(pageName) {
    // Use relative path to work in all environments
    const jsonPath = `content/${pageName}.json`;
    
    // Add cache-busting timestamp to ensure fresh content
    const timestamp = new Date().getTime();
    const url = `${jsonPath}?t=${timestamp}`;
    
    fetch(url, {
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
      })
      .then(data => {
        console.log(`Content loader: Successfully loaded ${jsonPath}`, data);
        injectContent(data);
      })
      .catch(error => {
        // Log error for debugging
        console.error(`Content loader: Could not load ${jsonPath}`, error);
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
    
    elements.forEach(element => {
      const path = element.getAttribute('data-content');
      const value = getNestedValue(data, path);
      if (value !== null) {
        // Special handling for footer contact (needs HTML)
        if (path === 'footer.contact') {
          const contact = data.footer?.contact;
          if (contact) {
            setHTMLContent(element, `${contact.address}<br>${contact.phone}<br>${contact.email}`);
          }
        } else {
          setTextContent(element, value);
        }
      } else {
        console.warn(`Content loader: No value found for path: ${path}`);
      }
    });

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
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    
    let pageName = 'home';
    if (page === 'index.html' || page === '' || page === '/') {
      pageName = 'home';
    } else if (page === 'kitchen.html') {
      pageName = 'kitchen';
    } else if (page === 'master-bedroom.html') {
      pageName = 'master-bedroom';
    } else if (page === 'closet.html') {
      pageName = 'closet';
    } else if (page === 'kids-bedroom.html') {
      pageName = 'kids';
    }

    // Load content when DOM is ready
    // Use setTimeout to ensure all scripts and DOM elements are fully loaded
    function loadContent() {
      // Small delay to ensure all elements are rendered
      setTimeout(() => {
        loadPageContent(pageName);
      }, 100);
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadContent);
    } else if (document.readyState === 'interactive') {
      // DOM is ready but resources may still be loading
      loadContent();
    } else {
      // DOM is fully loaded
      loadContent();
    }
  }

  // Initialize
  init();
})();
