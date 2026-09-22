# FireFly Sync

[中文说明文档 (Chinese Documentation)](./README_zh.md)

**FireFly Sync** is an Obsidian desktop plugin that synchronizes Markdown notes and referenced images to your local [FireFly](https://github.com/Deanyu148/FireFly) Astro blog repository, automatically creating Git commits and pushing changes to your remote repository.

---

## Features

- **Blog Git Status Panel**: A dedicated right-sidebar view showing modified, added, and untracked files in your blog repository with quick diff review.
- **Selective Syncing**:
  - **Current Note Mode**: Syncs the currently active markdown note and automatically detects and syncs all referenced images.
  - **Full Vault Mode**: Syncs all valid markdown notes and the entire `images/` directory.
- **Interactive Directory Tree**: Tree-view selection interface featuring search filtering, folder collapse/expand, directory-level toggles, and select/clear all.
- **Diff Preview & Confirmation**: Generates git diff previews for every selected file before modifying the target blog repository, allowing individual items to be unchecked before commit.
- **Customizable Target Paths**: Configurable blog repository root, post directory (default: `src/content/posts`), and media directory (default: `src/content/posts/images`), equipped with native "Browse..." folder pickers.
- **Network Proxy Support**: Configurable Git proxy supporting `http://`, `https://`, `socks4://`, and `socks5://` protocols for seamless pushing to GitHub or other remote hosts.

---

## Development

Prerequisites: Node.js (>= 18) and `pnpm`.

```bash
# Install dependencies
pnpm install

# Run TypeScript checking and build plugin bundle
pnpm run build

# Run unit and integration tests
pnpm test
```

Building produces `main.js` in the repository root. A complete plugin release package requires:
- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

---

## Installation to Obsidian

### Method 1: Portable Release (Recommended)
1. Download `firefly-sync.zip` from the [Latest Release](https://github.com/Deanyu148/firefly_sync/releases/latest).
2. Extract the archive into your Obsidian vault's `.obsidian/plugins/` directory (resulting in `.obsidian/plugins/firefly-sync/`).
3. Reload Obsidian (`Ctrl + R`) or restart the application.
4. Go to **Settings -> Community plugins**, disable Restricted mode if active, and enable **FireFly Sync**.

### Method 2: Manual Installation
Copy `manifest.json`, `main.js`, `styles.css`, and `versions.json` into `<Your-Vault>/.obsidian/plugins/firefly-sync/`.

---

## Configuration

In Obsidian, navigate to **Settings -> FireFly Sync**:
1. **Blog Repository Path**: Enter or browse for the local path of your FireFly git repository (e.g. `E:\FireFly`).
2. **Blog Posts Directory**: Relative path for markdown posts (default: `src/content/posts`).
3. **Blog Images Directory**: Relative path for images/attachments (default: `src/content/posts/images`).
4. **Git Remote & Branch**: Remote name (`origin` by default) and push branch (leave blank to use the active checked-out branch).
5. **Network Proxy**: Optional proxy URL for Git push commands (e.g., `socks5://127.0.0.1:7897` or `http://127.0.0.1:7890`).

---

## License

This project is licensed under the [MIT License](./LICENSE).
