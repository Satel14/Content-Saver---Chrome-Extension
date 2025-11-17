(function() {
  'use strict';

  const CONFIG = {
    MAX_TEXT_LENGTH: 5000,
    MAX_PREVIEW_LENGTH: 200,
    MAX_LINK_TEXT_LENGTH: 100,
    NOTIFICATION_DURATION: 2000,
    NOTIFICATION_FADE_DURATION: 300
  };

  function extractPageContent() {
    try {
      const content = {
        url: window.location.href,
        title: document.title || 'Untitled',
        timestamp: new Date().toISOString(),
        text: extractText(),
        images: extractImages(),
        links: extractLinks(),
        headings: extractHeadings(),
        metadata: {
          domain: window.location.hostname,
          path: window.location.pathname
        }
      };

      return content;
    } catch (error) {
      console.error('Error extracting page content:', error);
      return createErrorContent(error);
    }
  }

  function extractText() {
    try {
      const mainContent = document.querySelector('main, article, [role="main"]');
      const source = mainContent || document.body;
      
      let text = source.innerText || source.textContent || '';
      
      text = text.replace(/\s+/g, ' ').trim();
      
      if (text.length > CONFIG.MAX_TEXT_LENGTH) {
        text = text.substring(0, CONFIG.MAX_TEXT_LENGTH) + '...';
      }
      
      return text;
    } catch (error) {
      console.error('Error extracting text:', error);
      return '';
    }
  }

  function extractImages() {
    try {
      const images = [];
      const imageElements = document.querySelectorAll('img');
      
      imageElements.forEach(img => {
        try {
          const src = img.src || img.getAttribute('src');
          if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
            images.push({
              src: src,
              alt: img.alt || '',
              width: img.naturalWidth || 0,
              height: img.naturalHeight || 0
            });
          }
        } catch (error) {
          console.warn('Error processing image:', error);
        }
      });

      return images.slice(0, 50);
    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
  }

  function extractLinks() {
    try {
      const links = [];
      const linkElements = document.querySelectorAll('a[href]');
      const seenUrls = new Set();

      linkElements.forEach(link => {
        try {
          const href = link.href;
          if (href && !seenUrls.has(href)) {
            seenUrls.add(href);
            const text = (link.innerText || link.textContent || '').trim();
            
            links.push({
              href: href,
              text: text.substring(0, CONFIG.MAX_LINK_TEXT_LENGTH),
              title: link.title || ''
            });
          }
        } catch (error) {
          console.warn('Error processing link:', error);
        }
      });

      return links.slice(0, 100);
    } catch (error) {
      console.error('Error extracting links:', error);
      return [];
    }
  }

  function extractHeadings() {
    try {
      const headings = [];
      const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

      headingElements.forEach(heading => {
        try {
          const text = (heading.innerText || heading.textContent || '').trim();
          if (text) {
            headings.push({
              level: heading.tagName.toLowerCase(),
              text: text.substring(0, CONFIG.MAX_PREVIEW_LENGTH)
            });
          }
        } catch (error) {
          console.warn('Error processing heading:', error);
        }
      });

      return headings;
    } catch (error) {
      console.error('Error extracting headings:', error);
      return [];
    }
  }

  function createErrorContent(error) {
    return {
      url: window.location.href,
      title: document.title || 'Error',
      timestamp: new Date().toISOString(),
      error: true,
      errorMessage: error.message,
      text: '',
      images: [],
      links: [],
      headings: []
    };
  }

  function saveSelection(providedText) {
    try {
      let selectedText = '';
      
      if (providedText && providedText.trim()) {
        selectedText = providedText.trim();
      } else {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          selectedText = selection.toString().trim();
        }
      }
      
      if (selectedText.length === 0) {
        showNotification('No text selected', 'error');
        return;
      }

      const content = {
        url: window.location.href,
        title: document.title || 'Untitled',
        timestamp: new Date().toISOString(),
        type: 'selection',
        text: selectedText,
        context: {
          url: window.location.href,
          title: document.title,
          domain: window.location.hostname
        }
      };

      chrome.runtime.sendMessage(
        {
          action: 'saveContent',
          data: content
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
            showNotification('Error saving content', 'error');
            return;
          }

          if (response?.success) {
            showNotification('Content saved successfully!', 'success');
          } else {
            showNotification('Failed to save content', 'error');
          }
        }
      );
    } catch (error) {
      console.error('Error saving selection:', error);
      showNotification('Error saving selection', 'error');
    }
  }

  function showNotification(message, type = 'success') {
    try {
      const existing = document.getElementById('content-saver-notification');
      if (existing) {
        existing.remove();
      }

      const notification = document.createElement('div');
      notification.id = 'content-saver-notification';
      
      const bgColor = type === 'success' ? '#4CAF50' : '#f44336';
      
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
        word-wrap: break-word;
        opacity: 0;
        transition: opacity ${CONFIG.NOTIFICATION_FADE_DURATION}ms ease-in-out;
        pointer-events: none;
      `;
      
      notification.textContent = message;
      document.body.appendChild(notification);

      requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.pointerEvents = 'auto';
      });

      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, CONFIG.NOTIFICATION_FADE_DURATION);
      }, CONFIG.NOTIFICATION_DURATION);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      switch (request.action) {
        case 'extractContent':
          const content = extractPageContent();
          sendResponse({ success: true, data: content });
          break;

        case 'saveSelection':
          saveSelection(request.selectionText);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }

    return true;
  });

})();
