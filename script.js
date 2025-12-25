/* ===========================
   HEADER NAV INDICATOR & SMOOTH SCROLLING
   ===========================*/
(function headerNavIndicator(){
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  
  const links = Array.from(nav.querySelectorAll('.nav-link'));
  const underline = document.getElementById('navUnderline');
  
  if (!underline) return;

  // Detect if we're on the home page (more robust for Netlify)
  function checkIsHomePage() {
    const path = window.location.pathname;
    // Remove trailing slash and normalize
    const normalizedPath = path.replace(/\/$/, '') || '/';
    const lastSegment = normalizedPath.split('/').pop() || '';
    
    return normalizedPath === '/' || 
           normalizedPath === '/index.html' ||
           normalizedPath.endsWith('/index.html') ||
           normalizedPath === '' ||
           lastSegment === '' ||
           lastSegment === 'index' ||
           lastSegment === 'index.html' ||
           (!normalizedPath.includes('.html') && 
            !normalizedPath.match(/\/(kitchen|master-bedroom|closet|kids-bedroom|about-us)$/) &&
            lastSegment !== 'kitchen' && 
            lastSegment !== 'master-bedroom' && 
            lastSegment !== 'closet' && 
            lastSegment !== 'kids-bedroom' &&
            lastSegment !== 'about-us');
  }
  
  const isHomePage = checkIsHomePage();

  function updateIndicator(el){
    if(!el) { 
      underline.style.width='0'; 
      return; 
    }
    // Ensure we have valid elements
    if (!nav || !underline) return;
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      if (rect && navRect && rect.width > 0) {
        const left = (rect.left - navRect.left);
        const width = rect.width;
        
        // Ensure values are valid numbers
        if (!isNaN(left) && !isNaN(width) && width > 0) {
          underline.style.left = left + 'px';
          underline.style.width = width + 'px';
        }
      }
    });
  }

  // Remove aria-current from all links
  function clearActiveStates() {
    links.forEach(link => {
      link.removeAttribute('aria-current');
    });
  }

  // Store the currently active link
  let activeLink = null;
  let hoveredLink = null;

  // Set active state on a link
  function setActiveLink(link) {
    clearActiveStates();
    if (link) {
      link.setAttribute('aria-current', 'page');
      activeLink = link;
      // Always update indicator when setting active link (hover will override if needed)
      // Use requestAnimationFrame to ensure layout is ready, but only if not hovering
      if (!hoveredLink) {
        // Try immediate update first
        updateIndicator(link);
        // Also try after a frame to ensure layout is ready
        requestAnimationFrame(() => {
          if (!hoveredLink && activeLink === link) {
            updateIndicator(link);
          }
        });
      }
    }
  }

  // Detect active page based on current URL (more robust for Netlify)
  function detectActivePage() {
    const currentPath = window.location.pathname;
    // Normalize path: remove trailing slash, handle both /page and /page.html
    let normalizedPath = currentPath.replace(/\/$/, '') || '/';
    let currentPage = normalizedPath.split('/').pop() || 'index.html';
    
    // Handle empty path (root)
    if (!currentPage || currentPage === '') {
      currentPage = 'index.html';
    }
    
    // If path doesn't have .html extension, try to match without it
    // e.g., /kitchen should match kitchen.html
    const currentPageWithoutExt = currentPage.replace('.html', '');
    
    // Find the link that matches the current page
    const matchingLink = links.find(link => {
      const href = link.getAttribute('href');
      if (!href) return false;
      
      // Skip anchor links (like #contact)
      if (href.startsWith('#')) return false;
      
      // Handle both relative and absolute paths
      const linkPath = href.startsWith('/') ? href : href;
      const linkPage = linkPath.split('/').pop();
      const linkPageWithoutExt = linkPage.replace('.html', '');
      
      // Multiple matching strategies for Netlify compatibility
      // 1. Exact match with extension
      if (linkPage === currentPage) return true;
      
      // 2. Match without extension
      if (linkPageWithoutExt === currentPageWithoutExt && currentPageWithoutExt !== 'index') return true;
      
      // 3. Match path ending with page name
      if (normalizedPath !== '/' && normalizedPath.endsWith('/' + linkPageWithoutExt)) return true;
      
      // 4. Match exact path
      if (normalizedPath !== '/' && normalizedPath === '/' + linkPageWithoutExt) return true;
      
      // 5. Match using window.location for deployment scenarios
      const fullUrl = window.location.href;
      const urlPath = new URL(fullUrl).pathname.replace(/\/$/, '');
      if (urlPath.endsWith('/' + linkPageWithoutExt) || urlPath === '/' + linkPageWithoutExt) return true;
      
      return false;
    });
    
    return matchingLink || null;
  }

  // Initial setup - run on both DOMContentLoaded and load for better compatibility
  function initializeHeader() {
    // Use requestAnimationFrame to ensure DOM is fully ready
    requestAnimationFrame(() => {
      // Re-check isHomePage in case path changed
      const currentIsHomePage = checkIsHomePage();
      
      if (currentIsHomePage) {
        // On home page: no active link, no underline initially
        activeLink = null;
        hoveredLink = null;
        updateIndicator(null);
      } else {
        // On other pages: detect and set active link
        const detectedLink = detectActivePage();
        if (detectedLink) {
          hoveredLink = null; // Clear any hover state
          setActiveLink(detectedLink);
          // Force update multiple times to ensure it sticks (for deployment scenarios)
          setTimeout(() => {
            if (activeLink === detectedLink && !hoveredLink) {
              updateIndicator(detectedLink);
            }
          }, 50);
          setTimeout(() => {
            if (activeLink === detectedLink && !hoveredLink) {
              updateIndicator(detectedLink);
            }
          }, 150);
          setTimeout(() => {
            if (activeLink === detectedLink && !hoveredLink) {
              updateIndicator(detectedLink);
            }
          }, 300);
        } else {
          // If detection fails, try multiple times (for Netlify redirects)
          let retryCount = 0;
          const maxRetries = 8;
          const retryInterval = 100;
          
          const retryDetection = () => {
            const retryLink = detectActivePage();
            if (retryLink) {
              hoveredLink = null;
              setActiveLink(retryLink);
              updateIndicator(retryLink);
              // Also update again after a delay to ensure it persists
              setTimeout(() => {
                if (activeLink === retryLink && !hoveredLink) {
                  updateIndicator(retryLink);
                }
              }, 100);
            } else if (retryCount < maxRetries) {
              retryCount++;
              setTimeout(retryDetection, retryInterval);
            }
          };
          
          setTimeout(retryDetection, 50);
        }
      }
    });
  }
  
  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHeader);
  } else {
    // DOM already loaded
    initializeHeader();
  }
  
  // Also run on window load as fallback
  window.addEventListener('load', () => {
    setTimeout(initializeHeader, 50);
    // Additional check after load completes
    setTimeout(initializeHeader, 200);
  });
  
  // Re-initialize on popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    setTimeout(initializeHeader, 50);
    setTimeout(initializeHeader, 200);
  });
  
  // Re-initialize on hashchange (for anchor links)
  window.addEventListener('hashchange', () => {
    setTimeout(initializeHeader, 50);
  });

  // Hover effects: move underline to hovered tab
  links.forEach(a => {
    a.addEventListener('mouseenter', () => {
      hoveredLink = a;
      updateIndicator(a);
    });
    
    a.addEventListener('mouseleave', (e) => {
      hoveredLink = null;
      // Check if we're moving to another nav link
      const relatedTarget = e.relatedTarget;
      const isMovingToNavLink = relatedTarget && (
        relatedTarget.classList.contains('nav-link') ||
        relatedTarget.closest('.nav-link') ||
        relatedTarget.closest('#mainNav')
      );
      
      // Return to active link if on a page, or hide underline if on home page
      if (!isMovingToNavLink) {
        // Re-check if we're on home page (in case path changed)
        const currentIsHomePage = checkIsHomePage();
        if (currentIsHomePage) {
          // On home page: hide underline when not hovering
          updateIndicator(null);
        } else if (activeLink) {
          // On other pages: return to active link
          updateIndicator(activeLink);
        } else {
          // If no active link detected, try to detect it now
          const detectedLink = detectActivePage();
          if (detectedLink) {
            setActiveLink(detectedLink);
          }
        }
      }
    });
  });

  // Handle mouse leave from entire nav container
  const navList = nav.querySelector('ul');
  if (navList) {
    navList.addEventListener('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget;
      // If leaving nav area and not entering another nav element
      if (relatedTarget && !relatedTarget.closest('#mainNav')) {
        hoveredLink = null;
        // Re-check if we're on home page
        const currentIsHomePage = checkIsHomePage();
        if (currentIsHomePage) {
          // On home page: hide underline
          updateIndicator(null);
        } else if (activeLink) {
          // On other pages: show active link
          updateIndicator(activeLink);
        } else {
          // If no active link detected, try to detect it now
          const detectedLink = detectActivePage();
          if (detectedLink) {
            setActiveLink(detectedLink);
          }
        }
      }
    });
  }

  // smooth scroll for nav links and set active state on click
  links.forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      
      // Handle Contact link specially - open modal instead of scrolling
      if (href === '#contact' && a.id === 'contactNavLink') {
        e.preventDefault();
        const contactModal = document.getElementById('contactModal');
        if (contactModal) {
          contactModal.classList.remove('hidden');
          document.body.style.overflow = 'hidden';
        }
        return;
      }
      
      // Only prevent default and scroll if it's an anchor link (starts with #)
      // Otherwise, allow normal navigation to other pages
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const id = href;
        const target = document.querySelector(id);
        if(target){
          const offset = 80; // header height offset
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
          
          // Close mobile menu if open
          const mobileMenu = nav.querySelector('ul');
          const menuToggle = document.getElementById('mobileMenuToggle');
          if (mobileMenu && mobileMenu.classList.contains('mobile-open')) {
            mobileMenu.classList.remove('mobile-open');
            if (menuToggle) {
              menuToggle.setAttribute('aria-expanded', 'false');
            }
          }
        }
      } else {
        // For page navigation links, set active state immediately
        // This ensures the underline appears even before page navigation completes
        hoveredLink = null; // Clear hover state
        activeLink = a; // Set immediately
        setActiveLink(a);
        
        // Force update indicator immediately
        updateIndicator(a);
        
        // Also set it after navigation completes to ensure it persists
        // Multiple checks to handle deployment timing issues
        setTimeout(() => {
          const detectedLink = detectActivePage();
          if (detectedLink) {
            hoveredLink = null;
            setActiveLink(detectedLink);
            updateIndicator(detectedLink);
          } else if (a) {
            // Fallback: use the clicked link
            hoveredLink = null;
            setActiveLink(a);
            updateIndicator(a);
          }
        }, 100);
        
        setTimeout(() => {
          const detectedLink = detectActivePage();
          if (detectedLink) {
            hoveredLink = null;
            setActiveLink(detectedLink);
            updateIndicator(detectedLink);
          } else if (a) {
            hoveredLink = null;
            setActiveLink(a);
            updateIndicator(a);
          }
        }, 300);
        
        // Additional check after a longer delay to ensure underline persists (especially for About Us page)
        setTimeout(() => {
          const detectedLink = detectActivePage();
          if (detectedLink) {
            hoveredLink = null;
            setActiveLink(detectedLink);
            updateIndicator(detectedLink);
          } else if (a) {
            hoveredLink = null;
            setActiveLink(a);
            updateIndicator(a);
          }
        }, 600);
        
        // Final check after page fully loads
        setTimeout(() => {
          const detectedLink = detectActivePage();
          if (detectedLink) {
            hoveredLink = null;
            setActiveLink(detectedLink);
            updateIndicator(detectedLink);
          } else if (a) {
            hoveredLink = null;
            setActiveLink(a);
            updateIndicator(a);
          }
        }, 1000);
      }
    });
  });

  // intersection observer to highlight active section
  // Only process anchor links (starting with #), not page links
  const sections = links.map(l => {
    const href = l.getAttribute('href');
    // Only use hrefs that start with # (anchor links)
    if (href && href.startsWith('#')) {
      return document.querySelector(href);
    }
    return null;
  }).filter(Boolean);

  if (sections.length > 0) {
    const io = new IntersectionObserver((entries) => {
      // Find the entry with highest intersection ratio
      let highestEntry = null;
      let highestRatio = 0;
      
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > highestRatio) {
          highestRatio = entry.intersectionRatio;
          highestEntry = entry;
        }
      });

      if (highestEntry) {
        // find the link that matches this target
        const link = links.find(l => l.getAttribute('href') === ('#' + highestEntry.target.id));
        if (link) setActiveLink(link);
      }
    }, { 
      threshold: [0, 0.25, 0.45, 0.65, 0.85, 1.0],
      rootMargin: '-80px 0px -50% 0px'
    });

    sections.forEach(s => { 
      if(s) io.observe(s); 
    });
  }
})();

/* Smooth scroll for other anchor links (contact, etc) */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  if (!link.classList.contains('nav-link')) {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href');
      // Handle scroll to top (#top or just #)
      if (id === '#top' || id === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }
});

/* Contact Nav Link - Open Modal */
(function contactNavLinkHandler() {
  const contactNavLink = document.getElementById('contactNavLink');
  const contactButton = document.getElementById('contactButton');
  const contactModal = document.getElementById('contactModal');
  
  function openContactModal() {
    if (contactModal) {
      contactModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }
  
  // Handle nav link
  if (contactNavLink) {
    contactNavLink.addEventListener('click', (e) => {
      e.preventDefault();
      openContactModal();
    });
  }
  
  // Handle button (for backward compatibility)
  if (contactButton) {
    contactButton.addEventListener('click', (e) => {
      e.preventDefault();
      openContactModal();
    });
  }
})();

// Handle scroll to top on page load if hash is #top
if (window.location.hash === '#top') {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* Lightbox: open/close helpers */
(function lightboxSetup(){
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");

  function openLightbox(src, alt='') {
    if (!lightbox || !lbImg) return;
    lbImg.src = src;
    lbImg.alt = alt;
    lightbox.classList.remove('hidden');
    lightbox.focus?.();
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.add('hidden');
    lbImg.src = '';
  }

  // Note: Removed unused lightbox handlers for gallery-card and kids-card (not used in current design)

  if (lightbox) {
    lightbox.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeLightbox();
    });
  }

  // expose to other scripts if needed
  window.openLightbox = openLightbox;
})();

/* ===========================
   MOBILE MENU TOGGLE
   ===========================*/
(function mobileMenuToggle() {
  const menuToggle = document.getElementById('mobileMenuToggle');
  const navMenu = document.getElementById('mainNav')?.querySelector('ul');
  
  if (!menuToggle || !navMenu) return;

  // Show/hide mobile menu button based on screen size
  function updateMenuVisibility() {
    if (window.innerWidth <= 768) {
      menuToggle.style.display = 'flex';
    } else {
      menuToggle.style.display = 'none';
      navMenu.classList.remove('mobile-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  }

  // Initial check
  updateMenuVisibility();
  
  // Update on resize
  window.addEventListener('resize', updateMenuVisibility);

  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navMenu.classList.contains('mobile-open');
    
    if (isOpen) {
      navMenu.classList.remove('mobile-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    } else {
      navMenu.classList.add('mobile-open');
      menuToggle.setAttribute('aria-expanded', 'true');
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (navMenu.classList.contains('mobile-open') && 
        !navMenu.contains(e.target) && 
        !menuToggle.contains(e.target)) {
      navMenu.classList.remove('mobile-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navMenu.classList.contains('mobile-open')) {
      navMenu.classList.remove('mobile-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.focus();
    }
  });
})();

/* ===========================
   HEADER SCROLL BEHAVIOR (Arclinea-style)
   ===========================*/
(function headerScrollBehavior() {
  // Wait for DOM to be ready
  function initHeaderScroll() {
    const header = document.getElementById('siteHeader');
    const heroSection = document.getElementById('heroSection');
    const footer = document.getElementById('contact');
    
    if (!header || !heroSection) {
      return;
    }

    let lastScrollTop = 0;
    let scrollThreshold = 80; // Hide header after scrolling 80px
    let isHeaderHidden = false;
    let ticking = false;

    function updateHeaderVisibility() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const heroHeight = heroSection.offsetHeight;

      // If at the top, always show header
      if (scrollTop < 50) {
        header.classList.remove('header-hidden');
        isHeaderHidden = false;
        lastScrollTop = scrollTop;
        ticking = false;
        return;
      }

      // Hide header when scrolling down past threshold
      // Show header when scrolling up
      if (scrollTop > lastScrollTop && scrollTop > scrollThreshold && !isHeaderHidden) {
        // Scrolling down - hide header
        header.classList.add('header-hidden');
        isHeaderHidden = true;
      } else if (scrollTop < lastScrollTop && isHeaderHidden) {
        // Scrolling up - show header
        header.classList.remove('header-hidden');
        isHeaderHidden = false;
      }

      // Show footer when scrolled past hero section
      if (footer) {
        const footerRect = footer.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        if (footerRect.top < windowHeight * 0.9) {
          footer.classList.add('visible');
        }
      }

      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeaderVisibility);
        ticking = true;
      }
    }, { passive: true });

    // Initial check for footer visibility
    if (footer) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            footer.classList.add('visible');
          }
        });
      }, { threshold: 0.1 });
      
      observer.observe(footer);
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScroll);
  } else {
    initHeaderScroll();
  }
  
  // Also try on window load as fallback
  window.addEventListener('load', initHeaderScroll);
})();


/* ===========================
   MOBILE TOUCH SCROLLING IMPROVEMENTS
   ===========================*/
(function mobileTouchImprovements() {
  // Improve touch scrolling for horizontal containers
  const horizontalContainers = document.querySelectorAll('.experience-cards-container, .horizontal-scroll-container, .experience-tabs-wrapper');
  
  horizontalContainers.forEach(container => {
    // Enable momentum scrolling on iOS
    container.style.webkitOverflowScrolling = 'touch';
    
    // Prevent vertical scroll when horizontally scrolling
    let isScrolling = false;
    container.addEventListener('touchstart', (e) => {
      isScrolling = false;
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
      if (!isScrolling) {
        const touch = e.touches[0];
        const startX = touch.pageX;
        const startY = touch.pageY;
        
        setTimeout(() => {
          const endX = touch.pageX;
          const endY = touch.pageY;
          const diffX = Math.abs(endX - startX);
          const diffY = Math.abs(endY - startY);
          
          if (diffX > diffY) {
            isScrolling = true;
          }
        }, 10);
      }
    }, { passive: true });
  });

  // Improve form input on mobile (prevent zoom on focus for iOS)
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');
  inputs.forEach(input => {
    if (window.innerWidth <= 768) {
      const fontSize = window.getComputedStyle(input).fontSize;
      if (parseFloat(fontSize) < 16) {
        input.style.fontSize = '16px';
      }
    }
  });
})();

/* Hero video handler - FINAL SIMPLE MOBILE-FIRST SOLUTION */
(function heroVideoHandler() {
  const video = document.getElementById("heroVideo");
  if (!video) return;

  const heroSection = video.parentElement;
  if (!heroSection) return;

  // Detect mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  // FORCE video visibility - use !important
  function forceVisible() {
    video.style.setProperty('display', 'block', 'important');
    video.style.setProperty('visibility', 'visible', 'important');
    video.style.setProperty('opacity', '1', 'important');
    heroSection.style.setProperty('display', 'block', 'important');
    heroSection.style.setProperty('visibility', 'visible', 'important');
  }
  forceVisible();

  // Configure video
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.style.pointerEvents = 'auto';

  // Make gradient non-interactive
  const gradient = heroSection.querySelector('.bg-gradient-to-b');
  if (gradient) {
    gradient.style.pointerEvents = 'none';
    gradient.style.zIndex = '1';
  }

  // Create play button
  let playBtn = document.getElementById('heroPlayOverlay');
  if (!playBtn) {
    playBtn = document.createElement('button');
    playBtn.id = 'heroPlayOverlay';
    playBtn.type = 'button';
    playBtn.innerHTML = '▶';
    playBtn.setAttribute('aria-label', 'Play video');
    
    Object.assign(playBtn.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: '10000',
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      border: 'none',
      background: 'rgba(255, 255, 255, 0.95)',
      color: '#1f1b18',
      fontSize: '36px',
      display: isMobile ? 'block' : 'none',
      cursor: 'pointer',
      pointerEvents: 'auto',
      touchAction: 'manipulation',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      lineHeight: '80px',
      textAlign: 'center',
      padding: '0',
      margin: '0'
    });
    
    heroSection.appendChild(playBtn);
  }

  // Simple play function
  function playVideo() {
    forceVisible();
    video.muted = true;
    video.playsInline = true;
    const p = video.play();
    if (p) {
      p.then(() => {
        playBtn.style.display = 'none';
        forceVisible();
      }).catch(() => {
        playBtn.style.display = 'block';
        forceVisible();
      });
    }
  }

  // Play button handlers - ULTRA SIMPLE
  playBtn.onclick = playVideo;
  playBtn.ontouchend = function(e) {
    e.preventDefault();
    e.stopPropagation();
    playVideo();
  };

  // Video element handlers - PRIMARY for mobile
  video.onclick = function(e) {
    if (video.paused) {
      e.preventDefault();
      e.stopPropagation();
      playVideo();
    }
  };
  
  video.ontouchend = function(e) {
    if (video.paused) {
      e.preventDefault();
      e.stopPropagation();
      playVideo();
    }
  };

  // Hero section handlers
  heroSection.onclick = function(e) {
    if (video.paused && !e.target.closest('#heroPlayOverlay')) {
      e.preventDefault();
      e.stopPropagation();
      playVideo();
    }
  };
  
  heroSection.ontouchend = function(e) {
    if (video.paused && !e.target.closest('#heroPlayOverlay')) {
      e.preventDefault();
      e.stopPropagation();
      playVideo();
    }
  };

  // Try autoplay
  function tryAutoplay() {
    forceVisible();
    video.muted = true;
    video.playsInline = true;
    const p = video.play();
    if (p) {
      p.then(() => {
        playBtn.style.display = 'none';
        forceVisible();
      }).catch(() => {
        if (isMobile) {
          playBtn.style.display = 'block';
        }
        forceVisible();
      });
    } else if (isMobile) {
      playBtn.style.display = 'block';
    }
  }

  // AGGRESSIVE visibility protection
  setInterval(forceVisible, 100);
  
  const obs = new MutationObserver(forceVisible);
  obs.observe(video, { attributes: true, attributeFilter: ['style', 'class'] });
  obs.observe(heroSection, { attributes: true, attributeFilter: ['style', 'class'] });

  // Prevent hiding on any interaction
  ['click', 'touchstart', 'touchend', 'mousedown'].forEach(evt => {
    document.addEventListener(evt, function(e) {
      if (!e.target.closest('#heroPlayOverlay')) {
        forceVisible();
      }
    }, true);
  });

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryAutoplay);
  } else {
    tryAutoplay();
  }
  
  window.addEventListener('load', tryAutoplay);
  
  // Show button on mobile if paused
  if (isMobile) {
    setTimeout(() => {
      if (video.paused) {
        playBtn.style.display = 'block';
      }
    }, 300);
  }
  
  // Watch play state
  video.addEventListener('play', () => {
    playBtn.style.display = 'none';
    forceVisible();
  });
  
  video.addEventListener('pause', () => {
    if (isMobile && !video.ended) {
      playBtn.style.display = 'block';
    }
    forceVisible();
  });
})();


/* ===========================
   STAGGERED REVEAL (Arclinea-like)
   ===========================*/
(function staggeredReveal(){
  // Stagger reveal for .reveal children using IntersectionObserver
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          const el = entry.target;
          const items = el.querySelectorAll('.reveal');
          
          items.forEach((it, i) => {
            // Reset transition delay
            it.style.transitionDelay = `${i * 80}ms`;
            it.classList.add('reveal-visible');
          });

          observer.unobserve(el);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -50px 0px' });

    // Observe sections for stagger reveals
    document.querySelectorAll('section').forEach(s => {
      if (s.querySelector('.reveal')) {
        io.observe(s);
      }
    });
  } else {
    // fallback: reveal all
    document.querySelectorAll('.reveal').forEach(it => it.classList.add('reveal-visible'));
  }
})();

/* IntersectionObserver reveal for individual reveal elements */
(function addRevealObserver(){
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('reveal-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-visible');
        io.unobserve(entry.target);
      }
    });
  }, { root: null, rootMargin: '0px', threshold: 0.18 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

/* ===========================
   ARCLINEA-STYLE SCROLL REVEAL (Text first, then images)
   ===========================*/
(function arclineaScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: show all elements
    document.querySelectorAll('.scroll-reveal-text, .scroll-reveal-image').forEach(el => {
      el.classList.add('revealed');
    });
    return;
  }

  // Observer for text elements (appear first)
  const textObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger text reveals
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, index * 100);
        textObserver.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -100px 0px',
    threshold: 0.1
  });

  // Observer for image elements (appear after text)
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Stagger image reveals after a delay
        setTimeout(() => {
          entry.target.classList.add('revealed');
        }, 200 + (index * 150));
        imageObserver.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.1
  });

  // Observe all text elements
  document.querySelectorAll('.scroll-reveal-text').forEach(el => {
    textObserver.observe(el);
  });

  // Observe all image elements
  document.querySelectorAll('.scroll-reveal-image').forEach(el => {
    imageObserver.observe(el);
  });
})();

/* ===========================
   SEASONAL EXPERIENCES TABS (Aman Style - Scroll to card with sliding line)
   ===========================*/
(function seasonalExperiencesTabs() {
  // Wait for DOM to be fully loaded
  function init() {
    const tabButtons = document.querySelectorAll('.experience-tab-indicator');
    const experienceCards = document.querySelectorAll('.experience-card');
    const cardsContainer = document.querySelector('.experience-cards-container');
    const cardsGrid = document.querySelector('.experience-cards-grid');

    if (!tabButtons.length || !experienceCards.length || !cardsContainer || !cardsGrid) {
      // Retry after a short delay if elements aren't ready
      setTimeout(init, 100);
      return;
    }

    let isScrolling = false;

    function scrollToCard(tabName) {
      // Find the target card
      const targetCard = Array.from(experienceCards).find(card => 
        card.getAttribute('data-tab') === tabName
      );

      if (!targetCard) return;

      // Find the button index
      const buttonIndex = Array.from(tabButtons).findIndex(btn => 
        btn.getAttribute('data-tab') === tabName
      );

      if (buttonIndex === -1) return;

      isScrolling = true;

      // Update active indicator immediately
      tabButtons.forEach((btn, idx) => {
        btn.classList.toggle('active', idx === buttonIndex);
      });

      // Calculate scroll position reliably
      requestAnimationFrame(() => {
        const containerWidth = cardsContainer.clientWidth;
        const cardWidth = targetCard.offsetWidth;
        
        // Method: Calculate position by summing previous siblings' widths
        let cardLeft = 0;
        const cardIndex = Array.from(experienceCards).indexOf(targetCard);
        
        // Sum widths of all previous cards
        for (let i = 0; i < cardIndex; i++) {
          cardLeft += experienceCards[i].offsetWidth;
        }
        
        // Add gap between cards (grid gap)
        const gridStyle = window.getComputedStyle(cardsGrid);
        const gap = parseFloat(gridStyle.gap) || 0;
        if (cardIndex > 0) {
          cardLeft += gap * cardIndex;
        }
        
        // Calculate scroll to center the card
        const cardCenter = cardLeft + (cardWidth / 2);
        const scrollTo = cardCenter - (containerWidth / 2);
        
        // Clamp to valid scroll range
        const maxScroll = Math.max(0, cardsContainer.scrollWidth - containerWidth);
        const finalScroll = Math.max(0, Math.min(scrollTo, maxScroll));
        
        // If container is not scrollable, try to force it by ensuring grid is wider
        if (maxScroll === 0 && cardsContainer.scrollWidth <= cardsContainer.clientWidth) {
          // Force the grid to be wider by ensuring cards maintain min-width
          cardsGrid.style.width = 'max-content';
          cardsGrid.style.minWidth = 'max-content';
        }

        // Perform the scroll
        cardsContainer.scrollTo({
          left: finalScroll,
          behavior: 'smooth'
        });

        // Reset scrolling flag after animation completes
        setTimeout(() => {
          isScrolling = false;
        }, 600);
      });
    }

    // Add click handlers to tab indicators
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const tabName = this.getAttribute('data-tab');
        if (tabName && !isScrolling) {
          scrollToCard(tabName);
        }
      });
      
      // Also add pointer events to ensure clicks work
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = 'auto';
    });

    // Update active indicator based on scroll position
    function updateActiveIndicator() {
      if (isScrolling) return;

      const containerRect = cardsContainer.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;
      
      let closestCard = null;
      let closestDistance = Infinity;

      experienceCards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distance = Math.abs(cardCenter - containerCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestCard = card;
        }
      });

      if (closestCard) {
        const activeTab = closestCard.getAttribute('data-tab');
        tabButtons.forEach((btn) => {
          const btnTab = btn.getAttribute('data-tab');
          btn.classList.toggle('active', btnTab === activeTab);
        });
      }
    }

    // Listen to scroll events
    cardsContainer.addEventListener('scroll', () => {
      if (!isScrolling) {
        requestAnimationFrame(updateActiveIndicator);
      }
    }, { passive: true });

    // Initialize - set first tab as active
    if (tabButtons[0]) {
      tabButtons[0].classList.add('active');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }
})();

// Contact Form Submission (Web3Forms)
const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    const first = document.getElementById("firstName");
    const last = document.getElementById("lastName");
    const email = document.getElementById("emailField");
    const subject = document.getElementById("subjectField");
    const errFirst = document.getElementById("errFirst");
    const errLast = document.getElementById("errLast");
    const errEmail = document.getElementById("errEmail");
    const errSubject = document.getElementById("errSubject");

    let valid = true;

    if (!first || !first.value.trim()) {
        if (errFirst) errFirst.classList.remove("hidden");
        valid = false;
    } else if (errFirst) errFirst.classList.add("hidden");

    if (!last || !last.value.trim()) {
        if (errLast) errLast.classList.remove("hidden");
        valid = false;
    } else if (errLast) errLast.classList.add("hidden");

    if (!email || !email.value.trim() || !email.value.includes("@")) {
        if (errEmail) errEmail.classList.remove("hidden");
        valid = false;
    } else if (errEmail) errEmail.classList.add("hidden");

    if (!subject || !subject.value.trim()) {
        if (errSubject) errSubject.classList.remove("hidden");
        valid = false;
    } else if (errSubject) errSubject.classList.add("hidden");

    if (!valid) return;

    const form = e.target;
    const formData = new FormData(form);

    const status = document.getElementById("formStatus");
    if (status) {
      status.innerHTML = "Sending...";
      status.classList.remove("text-green-600", "text-red-600");
    }

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData
      });

      const json = await response.json();

      if (status) {
        if (json.success) {
            status.innerHTML = "Message sent successfully!";
            status.classList.add("text-green-600");
            form.reset();
            
            // Close modal after 2 seconds
            const contactModal = document.getElementById("contactModal");
            setTimeout(() => {
              if (contactModal) {
                contactModal.classList.add("hidden");
                document.body.style.overflow = "";
              }
            }, 2000);
        } else {
            status.innerHTML = "Failed to send message. Try again.";
            status.classList.add("text-red-600");
        }
      }
    } catch (error) {
      if (status) {
        status.innerHTML = "Failed to send message. Try again.";
        status.classList.add("text-red-600");
      }
    }
  });
}

// Newsletter Form Submission (Web3Forms)
(function newsletterFormHandler() {
  function initNewsletterForm() {
    const newsletterForm = document.getElementById("newsletterForm");
    if (newsletterForm) {
      newsletterForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById("newsletterEmail");
        const status = document.getElementById("newsletterStatus");
        
        if (!emailInput) return;
        
        const email = emailInput.value.trim();

        if (status) {
          status.classList.remove("text-green-600", "text-red-600");
        }

        if (!email || !email.includes("@")) {
            if (status) {
              status.innerHTML = "Please enter a valid email.";
              status.classList.add("text-red-600");
            }
            return;
        }

        const formData = new FormData();
        formData.append("access_key", "9dc81b3a-2ab4-4b96-ac36-a324e55d0ebf");
        formData.append("email", email);
        formData.append("subject", "New Newsletter Subscription");

        try {
          const response = await fetch("https://api.web3forms.com/submit", {
              method: "POST",
              body: formData
          });

          const json = await response.json();
          if (status) {
            if (json.success) {
                status.innerHTML = "Subscribed!";
                status.classList.add("text-green-600");
                emailInput.value = "";
                // Scroll to top after 2 seconds
                setTimeout(() => {
                  status.innerHTML = "";
                  status.classList.remove("text-green-600");
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 2000);
            } else {
                status.innerHTML = "Failed. Try again.";
                status.classList.add("text-red-600");
            }
          }
        } catch (error) {
          if (status) {
            status.innerHTML = "Failed. Try again.";
            status.classList.add("text-red-600");
          }
        }
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsletterForm);
  } else {
    // DOM already loaded
    initNewsletterForm();
  }
  
  // Also try on window load as fallback
  window.addEventListener('load', initNewsletterForm);
})();

  // ==== Footer visibility fallback for short pages ====
  (function footerFallbackVisible(){
    const footer = document.getElementById('contact');
    if (!footer) return;
  
    // If page is short (no vertical scroll), ensure footer is visible immediately
    const pageHeight = document.body.scrollHeight;
    const winH = window.innerHeight;
    if (pageHeight <= winH + 120) {
      footer.classList.add('visible');
    }
  
    // Also add a safe-load fallback: if footer not visible after load + 400ms, make visible
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (!footer.classList.contains('visible')) footer.classList.add('visible');
      }, 400);
    });
  })();

