# FireFly Sync (中文文档)

FireFly Sync 是一个 Obsidian 社区插件：它把选中的 Markdown 文章及关联的图片附件复制到本地 FireFly 博客仓库，并通过 Git 自动提交与推送到远程仓库。

## 核心功能

- **右侧侧边栏**：实时显示目标博客的 Git 修改状态，点击即可查看文件差异（Diff）。
- **同步选择窗口**：支持“当前文章”（自动分析文章引用的图片）与“整个 Vault”两种选择模式。
- **层级目录树**：提供类似 Obsidian 文件树的折叠、搜索、目录级勾选与全选/清空功能。
- **Diff 预览与二次确认**：在同步并提交前展示新增/修改差异，支持在弹窗中取消勾选不需要同步的文件。
- **自定义路径与目录浏览**：支持自定义博客仓库路径、文章存放目录及图片附件存放目录，各输入框均支持“浏览...”按钮选择目录。
- **网络代理支持**：支持配置 HTTP、HTTPS、SOCKS4、SOCKS5 代理，以便在网络受限时顺利推送到 GitHub 等远程仓库。

## 开发

```powershell
pnpm install
pnpm run build
pnpm test
```

## 安装到本地 Vault

1. 在插件设置中填写本地博客仓库路径（例如 `E:\FireFly`）。
2. 将 `manifest.json`、`main.js`、`styles.css` 和 `versions.json` 放入 Vault 的 `.obsidian/plugins/firefly-sync/`。
3. 在 Obsidian 的“设置 → 社区插件”中启用 FireFly Sync。
4. 点击左侧功能区图标或使用命令打开同步面板。
