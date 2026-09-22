// Obsidian language detection
type ObsidianModule = { getLanguage?: () => string };

export type SupportedLanguage = "en" | "zh";

const en = {
	// Commands & Ribbon
	cmdOpenSyncPanel: "Open sync panel",
	cmdSyncCurrentNote: "Sync current note",
	cmdSyncFullVault: "Sync full FireFly vault",
	ribbonTitle: "Open FireFly Sync",

	// Notices & Errors
	noticeCannotOpenRightLeaf: "Unable to open the FireFly Sync side panel.",
	noticeReadGitStatusFailed: (err: string) => `Failed to read blog Git status: ${err}`,
	noticeOpenSelectorFailed: (err: string) => `Unable to open sync selector: ${err}`,
	noticeSyncSuccess: (msg: string) => msg,
	noticeSyncFailed: (err: string) => `Sync failed: ${err}`,
	errDetachedHead: "Target blog repository is in a detached HEAD state. Please specify a branch in settings.",
	errDesktopOnly: "FireFly Sync only supports local desktop file system vaults.",
	errNoteNotFound: (path: string) => `Selected note does not exist: ${path}`,
	errNoteIgnored: (path: string) => `File is in an ignored folder and cannot be synced: ${path}`,
	errConfigRepoFirst: "Please configure the FireFly blog repository path in plugin settings (e.g. E:\\FireFly).",
	errFullVaultLayout: (path: string) => `Full vault sync requires a path structured as <workspace>\\firefly\\firefly. Current vault: ${path}`,
	errMissingObsidianDir: (path: string) => `Vault root missing .obsidian: ${path}`,
	errNoFilesToCommit: "No files to commit.",
	msgNoGitChanges: "No new Git changes detected, commit not created.",
	msgCommittedAndPushed: (count: number, remote: string, branchLabel: string, proxyLabel: string) =>
		`Committed ${count} files and pushed to ${remote}${branchLabel}${proxyLabel}.`,
	proxyLabel: (proxy: string) => ` (via proxy ${proxy})`,

	// Git Status Labels
	statusAdded: "Added",
	statusModified: "Modified",
	statusUntracked: "Untracked",
	statusDeleted: "Deleted",
	statusRenamed: "Renamed",
	statusConflicted: "Conflicted",
	statusUnchanged: "Unchanged",
	statusPending: "Pending",

	// Sidebar View
	viewTitle: "FireFly Sync",
	refreshAriaLabel: "Refresh Git status",
	settingsAriaLabel: "Open FireFly Sync settings",
	repoPlaceholder: "Please configure blog repository path in settings",
	btnSyncCurrent: "Sync Current Note",
	btnSyncVault: "Sync Full Vault",
	headingBlogGitChanges: "Blog Git Changes",
	sidebarTooltip: "Review git diff previews after selecting notes. Only confirmed changes will be copied and committed.",
	btnOpenSelector: "Open Sync Selector",
	sidebarEmptyNoRepo: "Working tree changes will appear here after configuring the blog repository.",
	sidebarEmptyClean: "Blog working directory is clean.",

	// Settings Tab
	settingsTitle: "FireFly Sync",
	settingsHeaderDesc: "Configure local FireFly blog repository, post directory, and media attachment path.",
	settingRepoPathName: "Blog repository path",
	settingRepoPathDesc: "Root directory of the initialized FireFly Git repository (e.g. E:\\FireFly).",
	btnBrowse: "Browse...",
	tooltipBrowseRepo: "Select blog repository root directory",
	settingPostsPathName: "Blog posts directory",
	settingPostsPathDesc: "Path relative to blog repository root, default: src/content/posts.",
	tooltipBrowsePosts: "Select blog posts directory",
	settingImagesPathName: "Blog images/media directory",
	settingImagesPathDesc: "Path relative to blog repository root, default: src/content/posts/images.",
	tooltipBrowseImages: "Select blog images/media directory",
	settingRemoteName: "Git remote",
	settingRemoteDesc: "Remote name (default: origin).",
	settingBranchName: "Push branch",
	settingBranchDesc: "Leave empty to use the current checked-out branch.",
	settingCommitMsgName: "Commit message",
	defaultCommitMsg: "Sync Obsidian notes to FireFly",
	settingProxyName: "Network proxy",
	settingProxyDesc: "Optional. Used for Git push. Supports http://, https://, socks4://, socks5:// (e.g. socks5://127.0.0.1:7897). Leave blank for direct connection.",
	settingIgnoredFoldersName: "Vault ignored folders",
	settingIgnoredFoldersDesc: "Full vault mode will skip these folders, comma-separated. Default: .obsidian.",
	dialogSelectDirectory: "Select Directory",

	// Modals
	modalSelectTitle: "Select Posts to Sync",
	modalSelectNote: "Select markdown notes using the vault tree. A git diff preview will be shown before pushing to the blog.",
	modalSyncScopeName: "Sync Scope",
	modalSyncScopeDesc: "Current note selects active note only; full vault selects all eligible markdown notes.",
	scopeCurrent: "Current note",
	scopeVault: "Full vault",
	modalFilterName: "Filter notes",
	modalFilterPlaceholder: "Search files or folders...",
	btnSelectAll: "Select all",
	btnClear: "Clear",
	btnCancel: "Cancel",
	btnReviewDiff: "Review Diff",
	treeEmpty: "No eligible markdown notes found.",
	selectionCount: (count: number, isCurrent: boolean) =>
		`${count} notes selected${isCurrent ? " (active note default)" : ""}`,
	noticeSelectAtLeastOne: "Please select at least one note.",
	noticeDiffError: (err: string) => `Failed to generate diff: ${err}`,

	// Diff Modal
	modalDiffTitle: "Review Git Diff",
	modalDiffNote: "Review git changes that will be copied and pushed to the FireFly blog. Uncheck any files to exclude.",
	btnBack: "Back",
	btnSyncAndPush: "Sync & Push",
	noticeKeepAtLeastOne: "Please keep at least one file selected.",
	diffNoChange: "No diff. Synchronizing this file will not alter content in the target repository.",

	// Status Modal
	statusModalTitle: (path: string) => `Git Change · ${path}`,
	statusModalEmpty: "No diff available to display.",
};

const zh: typeof en = {
	// Commands & Ribbon
	cmdOpenSyncPanel: "打开同步面板",
	cmdSyncCurrentNote: "同步当前文章",
	cmdSyncFullVault: "同步整个 FireFly Vault",
	ribbonTitle: "打开 FireFly Sync",

	// Notices & Errors
	noticeCannotOpenRightLeaf: "无法打开右侧 FireFly Sync 面板。",
	noticeReadGitStatusFailed: (err: string) => `读取博客 Git 状态失败：${err}`,
	noticeOpenSelectorFailed: (err: string) => `无法打开同步选择器：${err}`,
	noticeSyncSuccess: (msg: string) => msg,
	noticeSyncFailed: (err: string) => `同步失败：${err}`,
	errDetachedHead: "当前博客仓库处于 detached HEAD 状态，请在设置中指定要推送的分支。",
	errDesktopOnly: "FireFly Sync 仅支持桌面端的本地文件系统 Vault。",
	errNoteNotFound: (path: string) => `选择的文章不存在：${path}`,
	errNoteIgnored: (path: string) => `该文件位于忽略目录，不能同步：${path}`,
	errConfigRepoFirst: "请先在插件设置中填写 FireFly 博客仓库路径，例如 E:\\FireFly。",
	errFullVaultLayout: (path: string) => `同步整个 Vault 要求目录为 <工作区>\\firefly\\firefly，例如 E:\\文档\\firefly\\firefly。当前 Vault：${path}`,
	errMissingObsidianDir: (path: string) => `Vault 根目录缺少 .obsidian：${path}`,
	errNoFilesToCommit: "没有可提交的文件。",
	msgNoGitChanges: "没有检测到新的 Git 修改，未创建提交。",
	msgCommittedAndPushed: (count: number, remote: string, branchLabel: string, proxyLabel: string) =>
		`已提交 ${count} 个文件并推送到 ${remote}${branchLabel}${proxyLabel}。`,
	proxyLabel: (proxy: string) => `（经代理 ${proxy}）`,

	// Git Status Labels
	statusAdded: "新增",
	statusModified: "修改",
	statusUntracked: "未跟踪",
	statusDeleted: "删除",
	statusRenamed: "重命名",
	statusConflicted: "冲突",
	statusUnchanged: "无变化",
	statusPending: "待比较",

	// Sidebar View
	viewTitle: "FireFly Sync",
	refreshAriaLabel: "刷新 Git 状态",
	settingsAriaLabel: "打开 FireFly Sync 设置",
	repoPlaceholder: "请在设置中配置博客仓库路径",
	btnSyncCurrent: "同步当前文章",
	btnSyncVault: "同步整个 Vault",
	headingBlogGitChanges: "博客 Git 修改",
	sidebarTooltip: "选择文章后会先预览目标博客的 Git diff；确认后只复制并提交勾选的文件。",
	btnOpenSelector: "打开同步选择器",
	sidebarEmptyNoRepo: "配置博客仓库后，这里会显示 Git 工作区修改。",
	sidebarEmptyClean: "博客 Git 工作区没有修改。",

	// Settings Tab
	settingsTitle: "FireFly Sync",
	settingsHeaderDesc: "配置本地 FireFly 博客 Git 仓库及文章、附件存放路径。",
	settingRepoPathName: "博客仓库路径",
	settingRepoPathDesc: "例如 E:\\FireFly。必须是已经初始化的 Git 仓库。",
	btnBrowse: "浏览...",
	tooltipBrowseRepo: "选择博客仓库根目录",
	settingPostsPathName: "博客文章存放目录",
	settingPostsPathDesc: "相对于博客仓库的相对路径，默认 src/content/posts。也可以点击浏览选择。",
	tooltipBrowsePosts: "选择博客文章存放目录",
	settingImagesPathName: "博客附件/图片存放目录",
	settingImagesPathDesc: "相对于博客仓库的相对路径，默认 src/content/posts/images。也可以点击浏览选择。",
	tooltipBrowseImages: "选择博客附件/图片存放目录",
	settingRemoteName: "Git 远端",
	settingRemoteDesc: "默认 origin。",
	settingBranchName: "推送分支",
	settingBranchDesc: "留空时使用当前检出的分支。",
	settingCommitMsgName: "提交信息",
	defaultCommitMsg: "同步 Obsidian 文章到 FireFly",
	settingProxyName: "网络代理",
	settingProxyDesc: "可选。用于博客 Git 推送，支持 http://, https://, socks4://, socks5://（例如 socks5://127.0.0.1:7897 或 http://127.0.0.1:7890）。留空则直连。",
	settingIgnoredFoldersName: "Vault 忽略目录",
	settingIgnoredFoldersDesc: "整个 Vault 模式不会同步这些目录，逗号分隔。默认忽略 .obsidian。",
	dialogSelectDirectory: "请选择文件夹",

	// Modals
	modalSelectTitle: "选择同步内容",
	modalSelectNote: "以 Obsidian 文件浏览器的目录树选择文章。确认后会先显示目标博客的 Git 修改和差异。",
	modalSyncScopeName: "同步范围",
	modalSyncScopeDesc: "当前文章默认只选中当前打开的 Markdown；整个 Vault 会按目录树勾选所有可同步 Markdown。",
	scopeCurrent: "当前文章",
	scopeVault: "整个 Vault",
	modalFilterName: "筛选文章",
	modalFilterPlaceholder: "搜索文件或目录...",
	btnSelectAll: "全选",
	btnClear: "清空",
	btnCancel: "取消",
	btnReviewDiff: "查看选中差异",
	treeEmpty: "没有符合条件的 Markdown 文章。",
	selectionCount: (count: number, isCurrent: boolean) =>
		`${count} 篇文章已选择${isCurrent ? "（默认当前文章）" : ""}`,
	noticeSelectAtLeastOne: "请至少选择一篇文章。",
	noticeDiffError: (err: string) => `读取差异失败：${err}`,

	// Diff Modal
	modalDiffTitle: "查看 Git 修改与差异",
	modalDiffNote: "这里显示复制到 FireFly 博客后将产生的 Git diff。左侧可取消勾选不需要同步的文件。",
	btnBack: "返回",
	btnSyncAndPush: "同步并推送",
	noticeKeepAtLeastOne: "请至少保留一个需要同步的文件。",
	diffNoChange: "没有差异。同步此文件不会改变目标博客中的内容。",

	// Status Modal
	statusModalTitle: (path: string) => `Git 修改 · ${path}`,
	statusModalEmpty: "当前没有可显示的差异。",
};

export function t(): typeof en {
	let lang = "en";
	try {
		try {
		const obs: ObsidianModule = typeof require === "function" ? require("obsidian") : {};
		lang = (obs.getLanguage ? obs.getLanguage() : "en") || "en";
	} catch {
		lang = "en";
	}
	} catch {
		lang = "en";
	}
	if (lang.startsWith("zh")) {
		return zh;
	}
	return en;
}
