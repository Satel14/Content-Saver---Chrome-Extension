const CONFIG = {
  MAX_ENTRIES: 100,
  STORAGE_KEY: 'savedContent'
};

chrome.runtime.onInstalled.addListener(async () => {
  try {
    chrome.contextMenus.create({
      id: 'savePageContent',
      title: 'Save page content',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'saveSelection',
      title: 'Save selected text',
      contexts: ['selection']
    });

    await initializeStorage();
  } catch (error) {
    console.error('Error during extension installation:', error);
  }
});

async function initializeStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (!result[CONFIG.STORAGE_KEY]) {
        chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: [] }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'savePageContent') {
      await handleSavePageContent(tab);
    } else if (info.menuItemId === 'saveSelection') {
      const selectionText = info.selectionText || '';
      console.log('Selection text from context menu:', selectionText);
      if (!selectionText || selectionText.trim().length === 0) {
        console.error('No selection text found in info.selectionText');
        return;
      }
      await handleSaveSelection(tab, selectionText);
    }
  } catch (error) {
    console.error('Error handling context menu action:', error);
  }
});

async function handleSavePageContent(tab) {
  return new Promise((resolve, reject) => {
    if (!tab?.id) {
      reject(new Error('Invalid tab'));
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { action: 'extractContent' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error sending message to content script:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        if (response?.success && response.data) {
          saveContent(response.data)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error('Failed to extract content'));
        }
      }
    );
  });
}

async function handleSaveSelection(tab, selectionText) {
  if (!selectionText || !selectionText.trim()) {
    console.error('No selection text provided');
    return;
  }

  const trimmedText = selectionText.trim();
  console.log('Saving selection, length:', trimmedText.length, 'preview:', trimmedText.substring(0, 50));

  try {
    const url = tab.url || tab.pendingUrl || '';
    let domain = '';
    let path = '';

    try {
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        const urlObj = new URL(url);
        domain = urlObj.hostname;
        path = urlObj.pathname;
      }
    } catch (e) {
      console.warn('Could not parse URL:', url);
    }

    const content = {
      url: url,
      title: tab.title || 'Untitled',
      timestamp: new Date().toISOString(),
      type: 'selection',
      text: trimmedText,
      metadata: {
        domain: domain,
        path: path
      }
    };

    console.log('Content to save:', { 
      type: content.type, 
      textLength: content.text.length,
      textPreview: content.text.substring(0, 100)
    });

    await saveContent(content);
    console.log('Selection saved successfully');
  } catch (error) {
    console.error('Error saving selection:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch (request.action) {
        case 'saveContent':
          await saveContent(request.data);
          return { success: true };

        case 'getAllContent':
          const content = await getAllContent();
          return { success: true, data: content };

        case 'deleteContent':
          await deleteContent(request.index);
          return { success: true };

        case 'clearAll':
          await clearAllContent();
          return { success: true };

        case 'updateContent':
          await updateContent(request.index, request.data);
          return { success: true };

        case 'updateAllContent':
          await updateAllContent(request.data);
          return { success: true };

        case 'importContent':
          await importContent(request.data);
          return { success: true };

        case 'updateConfig':
          if (request.maxEntries) {
            CONFIG.MAX_ENTRIES = request.maxEntries;
          }
          return { success: true };

        default:
          return { success: false, error: 'Unknown action' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error.message };
    }
  };

  handleAsync().then(sendResponse).catch((error) => {
    sendResponse({ success: false, error: error.message });
  });

  return true;
});

async function saveContent(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid content data');
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const content = result[CONFIG.STORAGE_KEY] || [];
      
      if (!data.timestamp) {
        data.timestamp = new Date().toISOString();
      }
      if (!data.id) {
        data.id = generateId();
      }

      content.unshift(data);

      if (content.length > CONFIG.MAX_ENTRIES) {
        content.splice(CONFIG.MAX_ENTRIES);
      }

      chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: content }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

async function getAllContent() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[CONFIG.STORAGE_KEY] || []);
      }
    });
  });
}

async function deleteContent(index) {
  if (typeof index !== 'number' || index < 0) {
    throw new Error('Invalid index');
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const content = result[CONFIG.STORAGE_KEY] || [];
      
      if (index >= content.length) {
        reject(new Error('Index out of bounds'));
        return;
      }

      const filtered = content.filter((_, i) => i !== index);
      
      chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: filtered }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

async function clearAllContent() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: [] }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function updateContent(index, data) {
  if (typeof index !== 'number' || index < 0) {
    throw new Error('Invalid index');
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const content = result[CONFIG.STORAGE_KEY] || [];
      
      if (index >= content.length) {
        reject(new Error('Index out of bounds'));
        return;
      }

      content[index] = { ...content[index], ...data };

      chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: content }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

async function updateAllContent(data) {
  if (!Array.isArray(data)) {
    throw new Error('Invalid data format');
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: data }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function importContent(data) {
  if (!Array.isArray(data)) {
    throw new Error('Invalid import data');
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const existing = result[CONFIG.STORAGE_KEY] || [];
      
      const imported = data.map(item => {
        if (!item.id) {
          item.id = generateId();
        }
        if (!item.timestamp) {
          item.timestamp = new Date().toISOString();
        }
        return item;
      });

      const merged = [...imported, ...existing];
      const unique = merged.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
      );

      if (unique.length > CONFIG.MAX_ENTRIES) {
        unique.splice(CONFIG.MAX_ENTRIES);
      }

      chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: unique }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  });
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
