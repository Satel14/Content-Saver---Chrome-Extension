(function() {
  'use strict';

  let contentList, favoritesList, categoriesList;
  let saveCurrentPageBtn, themeToggle, settingsBtn;
  let searchInput, filterBtn, sortBtn, exportBtn, importBtn;
  let filterPanel, settingsPanel, modal;
  let tabButtons;

  let allContent = [];
  let favorites = new Set();
  let categories = new Set();
  let currentFilters = {};
  let currentSort = 'newest';
  let settings = {
    maxEntries: 100,
    autoSave: false,
    darkTheme: false,
    dateFormat: 'en-US'
  };

  async function init() {
    loadElements();
    await loadSettings();
    setupEventListeners();
    loadContent();
    setupTabs();
  }

  function loadElements() {
    contentList = document.getElementById('contentList');
    favoritesList = document.getElementById('favoritesList');
    categoriesList = document.getElementById('categoriesList');
    saveCurrentPageBtn = document.getElementById('saveCurrentPage');
    themeToggle = document.getElementById('themeToggle');
    settingsBtn = document.getElementById('settingsBtn');
    searchInput = document.getElementById('searchInput');
    filterBtn = document.getElementById('filterBtn');
    sortBtn = document.getElementById('sortBtn');
    exportBtn = document.getElementById('exportBtn');
    importBtn = document.getElementById('importBtn');
    filterPanel = document.getElementById('filterPanel');
    settingsPanel = document.getElementById('settingsPanel');
    modal = document.getElementById('modal');
    tabButtons = document.querySelectorAll('.tab-btn');
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get(['settings', 'favorites', 'categories']);
      if (result.settings) {
        settings = { ...settings, ...result.settings };
        applySettings();
      }
      if (result.favorites) {
        favorites = new Set(result.favorites);
      }
      if (result.categories) {
        categories = new Set(result.categories);
        updateCategoryFilters();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  function applySettings() {
    if (settings.darkTheme) {
      document.body.classList.add('dark');
    }
    const maxEntriesEl = document.getElementById('maxEntries');
    const autoSaveEl = document.getElementById('autoSave');
    const darkThemeEl = document.getElementById('darkTheme');
    const dateFormatEl = document.getElementById('dateFormat');
    
    if (maxEntriesEl) maxEntriesEl.value = settings.maxEntries;
    if (autoSaveEl) autoSaveEl.checked = settings.autoSave;
    if (darkThemeEl) darkThemeEl.checked = settings.darkTheme;
    if (dateFormatEl) dateFormatEl.value = settings.dateFormat;
  }

  function setupEventListeners() {
    saveCurrentPageBtn?.addEventListener('click', handleSaveCurrentPage);
    themeToggle?.addEventListener('click', toggleTheme);
    settingsBtn?.addEventListener('click', toggleSettings);
    filterBtn?.addEventListener('click', () => filterPanel.classList.toggle('hidden'));
    sortBtn?.addEventListener('click', showSortMenu);
    exportBtn?.addEventListener('click', handleExport);
    importBtn?.addEventListener('click', () => document.getElementById('importFile').click());
    
    document.getElementById('importFile')?.addEventListener('change', handleImport);
    document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
    document.getElementById('resetSettings')?.addEventListener('click', resetSettings);
    document.getElementById('addCategoryBtn')?.addEventListener('click', addCategory);
    document.getElementById('clearFilters')?.addEventListener('click', clearFilters);
    
    document.getElementById('filterType')?.addEventListener('change', applyFilters);
    document.getElementById('filterCategory')?.addEventListener('change', applyFilters);
    document.getElementById('filterDate')?.addEventListener('change', applyFilters);
    document.getElementById('filterDomain')?.addEventListener('input', debounce(applyFilters, 300));

    searchInput?.addEventListener('input', debounce((e) => {
      applyFilters();
    }, 300));

    document.querySelector('.modal-close')?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    chrome.storage.onChanged.addListener(() => {
      loadContent();
    });
  }

  function setupTabs() {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        switchTab(tabName);
      });
    });
  }

  function switchTab(tabName) {
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    if (tabName === 'favorites') {
      loadFavorites();
    } else if (tabName === 'statistics') {
      loadStatistics();
    } else if (tabName === 'categories') {
      loadCategories();
    }
  }

  async function handleSaveCurrentPage() {
    try {
      saveCurrentPageBtn.disabled = true;
      saveCurrentPageBtn.textContent = 'Saving...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found');

      const response = await sendMessageToTab(tab.id, { action: 'extractContent' });
      if (response?.success && response.data) {
        await sendMessage({ action: 'saveContent', data: response.data });
        showNotification('Page saved!', 'success');
        await loadContent();
      } else {
        throw new Error('Failed to extract content');
      }
    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
    } finally {
      saveCurrentPageBtn.disabled = false;
      saveCurrentPageBtn.textContent = 'Save Page';
    }
  }

  function toggleTheme() {
    settings.darkTheme = !settings.darkTheme;
    document.body.classList.toggle('dark', settings.darkTheme);
    document.getElementById('darkTheme').checked = settings.darkTheme;
    saveSettings();
  }

  function toggleSettings() {
    settingsPanel.classList.toggle('hidden');
  }

  async function saveSettings() {
    const maxEntriesEl = document.getElementById('maxEntries');
    const autoSaveEl = document.getElementById('autoSave');
    const darkThemeEl = document.getElementById('darkTheme');
    const dateFormatEl = document.getElementById('dateFormat');
    
    if (maxEntriesEl) settings.maxEntries = parseInt(maxEntriesEl.value) || 100;
    if (autoSaveEl) settings.autoSave = autoSaveEl.checked;
    if (darkThemeEl) settings.darkTheme = darkThemeEl.checked;
    if (dateFormatEl) settings.dateFormat = dateFormatEl.value;
    
    try {
      await chrome.storage.local.set({ settings });
      await sendMessage({ action: 'updateConfig', maxEntries: settings.maxEntries });
      applySettings();
      showNotification('Settings saved!', 'success');
      toggleSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      showNotification('Error saving settings', 'error');
    }
  }

  function resetSettings() {
    settings = {
      maxEntries: 100,
      autoSave: false,
      darkTheme: false,
      dateFormat: 'en-US'
    };
    applySettings();
    saveSettings();
  }

  async function loadContent() {
    try {
      showLoading();
      const response = await sendMessage({ action: 'getAllContent' });
      if (response?.success) {
        allContent = response.data || [];
        applyFilters();
      } else {
        showError('Failed to load content');
      }
    } catch (error) {
      showError('Error: ' + error.message);
    }
  }

  function applyFilters() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const typeFilter = document.getElementById('filterType')?.value || '';
    const categoryFilter = document.getElementById('filterCategory')?.value || '';
    const dateFilter = document.getElementById('filterDate')?.value || '';
    const domainFilter = document.getElementById('filterDomain')?.value.toLowerCase().trim() || '';

    let filtered = [...allContent];

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(searchQuery) ||
        item.text?.toLowerCase().includes(searchQuery) ||
        item.url?.toLowerCase().includes(searchQuery) ||
        item.metadata?.domain?.toLowerCase().includes(searchQuery)
      );
    }

    if (typeFilter) {
      filtered = filtered.filter(item => item.type === typeFilter || (!item.type && typeFilter === 'page'));
    }

    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (domainFilter) {
      filtered = filtered.filter(item => item.metadata?.domain?.toLowerCase().includes(domainFilter));
    }

    if (dateFilter) {
      const now = new Date();
      filtered = filtered.filter(item => {
        const date = new Date(item.timestamp);
        switch (dateFilter) {
          case 'today':
            return date.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return date >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return date >= monthAgo;
          default:
            return true;
        }
      });
    }

    if (currentSort === 'newest') {
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (currentSort === 'oldest') {
      filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (currentSort === 'title') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    displayContent(filtered);
  }

  function clearFilters() {
    searchInput.value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterDate').value = '';
    document.getElementById('filterDomain').value = '';
    applyFilters();
  }

  function showSortMenu() {
    const menu = document.createElement('div');
    menu.className = 'modal-content';
    menu.innerHTML = `
      <h3>Sort By</h3>
      <button class="btn btn-primary" style="width:100%;margin:5px 0" data-sort="newest">Newest First</button>
      <button class="btn btn-primary" style="width:100%;margin:5px 0" data-sort="oldest">Oldest First</button>
      <button class="btn btn-primary" style="width:100%;margin:5px 0" data-sort="title">Title A-Z</button>
    `;
    showModal(menu);
    menu.querySelectorAll('[data-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSort = btn.dataset.sort;
        applyFilters();
        modal.classList.add('hidden');
      });
    });
  }

  function displayContent(content) {
    if (!content || content.length === 0) {
      contentList.innerHTML = '<div class="empty">No entries found</div>';
      return;
    }

    contentList.innerHTML = content.map((item, index) => {
      const originalIndex = allContent.findIndex(c => c.id === item.id);
      return createContentItemHTML(item, originalIndex);
    }).join('');

    attachItemHandlers();
  }

  function createContentItemHTML(item, index) {
    const date = formatDate(item.timestamp);
    const preview = truncateText(item.text || '', 150);
    const title = escapeHtml(item.title || 'Untitled');
    const url = escapeHtml(item.url || '');
    const isFavorite = favorites.has(item.id);
    
    const badges = [];
    if (item.type === 'selection') {
      badges.push('<span class="badge badge-selection">Selection</span>');
    }
    if (item.category) {
      badges.push(`<span class="badge badge-category">${escapeHtml(item.category)}</span>`);
    }
    if (item.images?.length > 0) {
      badges.push(`<span class="badge badge-images">${item.images.length} img</span>`);
    }
    if (item.links?.length > 0) {
      badges.push(`<span class="badge badge-links">${item.links.length} links</span>`);
    }

    const imagesPreview = item.images?.slice(0, 3).map(img => 
      `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" onclick="window.open('${escapeHtml(img.src)}', '_blank')">`
    ).join('') || '';

    return `
      <div class="content-item" data-id="${item.id}">
        <div class="content-header">
          <h3 title="${title}">${title}</h3>
          <div class="content-actions">
            <button class="btn-action btn-favorite ${isFavorite ? 'active' : ''}" data-id="${item.id}" title="Favorite">★</button>
            <button class="btn-action btn-edit" data-index="${index}" title="Edit">✎</button>
            <button class="btn-action btn-delete" data-index="${index}" title="Delete">×</button>
          </div>
        </div>
        <div class="content-url">
          <a href="${url}" target="_blank" rel="noopener noreferrer">${truncateUrl(url, 60)}</a>
        </div>
        ${preview ? `<div class="content-preview">${escapeHtml(preview)}</div>` : ''}
        ${imagesPreview ? `<div class="image-preview">${imagesPreview}</div>` : ''}
        <div class="content-meta">
          <span class="timestamp">${date}</span>
          ${badges.join('')}
        </div>
      </div>
    `;
  }

  function attachItemHandlers() {
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.target.dataset.index);
        if (isNaN(index)) return;
        if (confirm('Delete this entry?')) {
          await sendMessage({ action: 'deleteContent', index });
          showNotification('Deleted', 'success');
          await loadContent();
        }
      });
    });

    document.querySelectorAll('.btn-favorite').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        toggleFavorite(id);
        await loadContent();
      });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        editEntry(index);
      });
    });
  }

  async function toggleFavorite(id) {
    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.add(id);
    }
    await chrome.storage.local.set({ favorites: Array.from(favorites) });
    showNotification(favorites.has(id) ? 'Added to favorites' : 'Removed from favorites', 'success');
  }

  function editEntry(index) {
    const item = allContent[index];
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
      <h3>Edit Entry</h3>
      <div style="margin:15px 0">
        <label>Title</label>
        <input type="text" id="editTitle" value="${escapeHtml(item.title || '')}" style="width:100%;padding:8px;margin-top:5px;border:1px solid #ddd;border-radius:4px">
      </div>
      <div style="margin:15px 0">
        <label>Category</label>
        <input type="text" id="editCategory" value="${escapeHtml(item.category || '')}" list="categories" style="width:100%;padding:8px;margin-top:5px;border:1px solid #ddd;border-radius:4px">
        <datalist id="categories">
          ${Array.from(categories).map(cat => `<option value="${escapeHtml(cat)}">`).join('')}
        </datalist>
      </div>
      <button class="btn btn-primary" id="saveEdit" style="width:100%">Save</button>
    `;
    showModal(modalBody.parentElement);
    
    document.getElementById('saveEdit').addEventListener('click', async () => {
      const title = document.getElementById('editTitle').value;
      const category = document.getElementById('editCategory').value;
      item.title = title;
      if (category) {
        item.category = category;
        if (!categories.has(category)) {
          categories.add(category);
          await chrome.storage.local.set({ categories: Array.from(categories) });
          updateCategoryFilters();
        }
      } else {
        delete item.category;
      }
      await sendMessage({ action: 'updateContent', index, data: item });
      showNotification('Updated', 'success');
      modal.classList.add('hidden');
      await loadContent();
    });
  }

  function loadFavorites() {
    const favs = allContent.filter(item => favorites.has(item.id));
    if (favs.length === 0) {
      favoritesList.innerHTML = '<div class="empty">No favorites yet</div>';
      return;
    }
    favoritesList.innerHTML = favs.map((item, index) => {
      const originalIndex = allContent.findIndex(c => c.id === item.id);
      return createContentItemHTML(item, originalIndex);
    }).join('');
    attachItemHandlers();
  }

  function loadStatistics() {
    const stats = {
      total: allContent.length,
      pages: allContent.filter(c => !c.type || c.type === 'page').length,
      selections: allContent.filter(c => c.type === 'selection').length,
      favorites: favorites.size,
      categories: categories.size
    };

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statPages').textContent = stats.pages;
    document.getElementById('statSelections').textContent = stats.selections;
    document.getElementById('statFavorites').textContent = stats.favorites;
    document.getElementById('statCategories').textContent = stats.categories;

    chrome.storage.local.getBytesInUse(null, (bytes) => {
      document.getElementById('statStorage').textContent = (bytes / 1024).toFixed(1) + ' KB';
    });

    const domainCounts = {};
    allContent.forEach(item => {
      const domain = item.metadata?.domain || 'unknown';
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });

    const sortedDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const maxCount = Math.max(...sortedDomains.map(d => d[1]), 1);
    const chart = document.getElementById('domainChart');
    chart.innerHTML = sortedDomains.map(([domain, count]) => `
      <div class="chart-item">
        <span class="chart-label">${truncateText(domain, 25)}</span>
        <div class="chart-bar" style="width: ${(count / maxCount) * 100}%"></div>
        <span class="chart-value">${count}</span>
      </div>
    `).join('');
  }

  function loadCategories() {
    const categoryCounts = {};
    allContent.forEach(item => {
      if (item.category) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }
    });

    categoriesList.innerHTML = Array.from(categories).map(cat => `
      <div class="category-item">
        <span class="category-name">${escapeHtml(cat)}<span class="category-count">(${categoryCounts[cat] || 0})</span></span>
        <button class="btn btn-danger btn-small" data-category="${escapeHtml(cat)}">Delete</button>
      </div>
    `).join('');

    categoriesList.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cat = btn.dataset.category;
        if (confirm(`Delete category "${cat}"?`)) {
          categories.delete(cat);
          await chrome.storage.local.set({ categories: Array.from(categories) });
          allContent.forEach(item => {
            if (item.category === cat) delete item.category;
          });
          await sendMessage({ action: 'updateAllContent', data: allContent });
          loadCategories();
          updateCategoryFilters();
        }
      });
    });
  }

  function addCategory() {
    const input = document.getElementById('newCategoryInput');
    const name = input.value.trim();
    if (name && !categories.has(name)) {
      categories.add(name);
      chrome.storage.local.set({ categories: Array.from(categories) });
      input.value = '';
      updateCategoryFilters();
      loadCategories();
      showNotification('Category added', 'success');
    }
  }

  function updateCategoryFilters() {
    const select = document.getElementById('filterCategory');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">All Categories</option>' +
      Array.from(categories).map(cat => 
        `<option value="${escapeHtml(cat)}" ${cat === current ? 'selected' : ''}>${escapeHtml(cat)}</option>`
      ).join('');
  }

  async function handleExport() {
    const format = confirm('Export as CSV? (Cancel for JSON)') ? 'csv' : 'json';
    const data = format === 'json' 
      ? JSON.stringify(allContent, null, 2)
      : convertToCSV(allContent);

    const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-saver-export-${new Date().toISOString().split('T')[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Exported!', 'success');
  }

  function convertToCSV(data) {
    const headers = ['Title', 'URL', 'Type', 'Category', 'Text', 'Timestamp'];
    const rows = data.map(item => [
      `"${(item.title || '').replace(/"/g, '""')}"`,
      `"${(item.url || '').replace(/"/g, '""')}"`,
      item.type || 'page',
      item.category || '',
      `"${(item.text || '').substring(0, 500).replace(/"/g, '""')}"`,
      item.timestamp
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const text = await file.text();
    let imported;
    try {
      if (file.name.endsWith('.json')) {
        imported = JSON.parse(text);
      } else {
        imported = parseCSV(text);
      }
      if (!Array.isArray(imported)) imported = [imported];
      
      await sendMessage({ action: 'importContent', data: imported });
      showNotification(`Imported ${imported.length} entries`, 'success');
      await loadContent();
    } catch (error) {
      showNotification('Import failed: ' + error.message, 'error');
    }
    event.target.value = '';
  }

  function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      return {
        title: values[0] || 'Imported',
        url: values[1] || '',
        type: values[2] || 'page',
        category: values[3] || '',
        text: values[4] || '',
        timestamp: values[5] || new Date().toISOString()
      };
    });
  }

  function showModal(content) {
    document.getElementById('modalBody').innerHTML = '';
    if (content instanceof HTMLElement && content.id !== 'modalBody') {
      document.getElementById('modalBody').appendChild(content);
    } else if (typeof content === 'string') {
      document.getElementById('modalBody').innerHTML = content;
    }
    modal.classList.remove('hidden');
  }

  function showLoading() {
    if (contentList) contentList.innerHTML = '<div class="loading">Loading...</div>';
  }

  function showError(message) {
    if (contentList) contentList.innerHTML = `<div class="empty error">${escapeHtml(message)}</div>`;
  }

  function showNotification(message, type = 'success') {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  }

  function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Unknown error'));
        }
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  function truncateUrl(url, maxLength) {
    if (!url) return '';
    if (url.length <= maxLength) return url;
    return '...' + url.substring(url.length - maxLength);
  }

  function formatDate(timestamp) {
    if (!timestamp) return 'Unknown date';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(settings.dateFormat, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
