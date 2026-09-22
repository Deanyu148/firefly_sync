# FireFly Sync

FireFly Sync 是一个 Obsidian 社区插件：它把选中的 Markdown 文章复制到本地 FireFly Astro 博客的 `src/content/posts`，然后使用博客仓库自己的 Git 提交并推送。远端仓库的 CI/CD 可以在收到 push 后自动部署，插件不参与部署流程。

## 功能

- 右侧 Obsidian 侧边栏，显示博客 Git 工作区修改；点击修改项可查看 diff。
- 官方 `Modal` 选择窗口：支持“当前文章”和“整个 Vault”两种模式。
- 当前文章模式默认选中当前打开的 Markdown 文件。
- 整个 Vault 模式使用和 Obsidian 文件浏览器类似的目录树、折叠、搜索、目录级复选框和全选/清空。
- 整个 Vault 模式只接受 `E:\文档\firefly\firefly` 这一类目录结构：Vault 目录名必须是 `firefly`，父目录名也必须是 `firefly`，并且根目录存在 `.obsidian`。
- 同步前按目标博客文件内容生成新增/修改/无变化预览，用户可在 diff 窗口逐文件取消同步。
- 只复制 Markdown 文章，不复制或修改 `images` 文件夹。
- 同步后执行 `git add`、`git commit`、`git push`，只提交本次勾选的文章路径。

## 开发

```powershell
npm install
npm run build
npm test
```

`npm run build` 会生成 Obsidian 所需的根目录 `main.js`。社区插件发布包至少需要以下文件：

- `manifest.json`
- `main.js`
- `styles.css`

## 安装到本地 Vault

1. 在插件设置中填写本地博客仓库路径，例如 `E:\FireFly`。
2. 将 `manifest.json`、`main.js`、`styles.css` 和 `versions.json` 放入 Vault 的 `.obsidian/plugins/firefly-sync/`。
3. 在 Obsidian 的“设置 → 社区插件”中启用 FireFly Sync。
4. 执行命令“FireFly Sync: 打开同步面板”，或点击左侧功能区图标。
5. 选择文章、查看 diff，确认后点击“同步并推送”。

插件是桌面端插件：它使用 Obsidian 官方 API 读取 Vault，并使用本机 Git 命令完成提交和推送。请提前在博客仓库中配置好 Git 用户身份、远端认证和推送权限。
