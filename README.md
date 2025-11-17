# Content Saver - Chrome Extension

A powerful Chrome extension for saving and organizing web page content with advanced features.

## ✨ Features

- **Save Page Content** - Extract and save full page content (text, images, links, headings)
- **Save Selections** - Quick save selected text via context menu
- **Categories & Tags** - Organize entries with custom categories
- **Favorites** - Star important entries for quick access
- **Advanced Filters** - Filter by type, category, date, domain, or search query
- **Export/Import** - Export to JSON/CSV or import your data
- **Statistics Dashboard** - View insights about your saved content
- **Dark Theme** - Toggle between light and dark modes
- **Edit Entries** - Modify titles and categories
- **Image Previews** - Quick preview of saved images

## 🚀 Quick Start

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder

## 📖 Usage

### Save Content
- **Via Popup**: Click extension icon → "Save Page"
- **Via Context Menu**: Right-click page → "Save page content"
- **Save Selection**: Select text → Right-click → "Save selected text"

### Manage Content
- **Search**: Use search bar to find entries
- **Filter**: Click filter icon for advanced options
- **Sort**: Sort by date or title
- **Edit**: Click edit icon to modify entries
- **Favorite**: Click star icon to mark favorites
- **Export**: Export all data as JSON or CSV

## 🎯 Key Features

### Tabs
- **Entries** - All saved content
- **Favorites** - Starred entries
- **Statistics** - Analytics and insights
- **Categories** - Manage categories

### Settings
- Configure max entries limit
- Toggle dark theme
- Set date format
- Auto-save options

## 🛠️ Tech Stack

- Manifest V3
- Chrome Storage API
- Content Scripts
- Service Workers
- Modern JavaScript (ES6+)

## 📦 Project Structure

```
├── manifest.json       # Extension config
├── background.js       # Service worker
├── content.js          # Content script
├── popup.html          # UI markup
├── popup.js            # UI logic
├── styles.css          # Styling
└── icons/              # Extension icons
```