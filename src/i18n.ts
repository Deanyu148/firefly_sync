// Obsidian language detection & Internationalization
type ObsidianModule = { getLanguage?: () => string };

export interface TranslationDict {
	// Commands & Ribbon
	cmdOpenSyncPanel: string;
	cmdSyncCurrentNote: string;
	cmdSyncFullVault: string;
	ribbonTitle: string;

	// Notices & Errors
	noticeCannotOpenRightLeaf: string;
	noticeReadGitStatusFailed: (err: string) => string;
	noticeOpenSelectorFailed: (err: string) => string;
	noticeSyncSuccess: (msg: string) => string;
	noticeSyncFailed: (err: string) => string;
	errDetachedHead: string;
	errDesktopOnly: string;
	errNoteNotFound: (path: string) => string;
	errNoteIgnored: (path: string) => string;
	errConfigRepoFirst: string;
	errFullVaultLayout: (path: string) => string;
	errMissingObsidianDir: (path: string) => string;
	errNoFilesToCommit: string;
	msgNoGitChanges: string;
	msgCommittedAndPushed: (count: number, remote: string, branchLabel: string, proxyLabel: string) => string;
	proxyLabel: (proxy: string) => string;

	// Git Status Labels
	statusAdded: string;
	statusModified: string;
	statusUntracked: string;
	statusDeleted: string;
	statusRenamed: string;
	statusConflicted: string;
	statusUnchanged: string;
	statusPending: string;

	// Sidebar View
	viewTitle: string;
	refreshAriaLabel: string;
	settingsAriaLabel: string;
	repoPlaceholder: string;
	btnSyncCurrent: string;
	btnSyncVault: string;
	headingBlogGitChanges: string;
	sidebarTooltip: string;
	btnOpenSelector: string;
	sidebarEmptyNoRepo: string;
	sidebarEmptyClean: string;

	// Settings Tab
	settingsTitle: string;
	settingsHeaderDesc: string;
	settingRepoPathName: string;
	settingRepoPathDesc: string;
	btnBrowse: string;
	tooltipBrowseRepo: string;
	settingPostsPathName: string;
	settingPostsPathDesc: string;
	tooltipBrowsePosts: string;
	settingImagesPathName: string;
	settingImagesPathDesc: string;
	tooltipBrowseImages: string;
	settingRemoteName: string;
	settingRemoteDesc: string;
	settingBranchName: string;
	settingBranchDesc: string;
	settingCommitMsgName: string;
	defaultCommitMsg: string;
	settingProxyName: string;
	settingProxyDesc: string;
	settingIgnoredFoldersName: string;
	settingIgnoredFoldersDesc: string;
	dialogSelectDirectory: string;

	// Translation Contribution in Settings
	settingContributeI18nName: string;
	settingContributeI18nDesc: string;
	btnContributeI18n: string;

	// Modals
	modalSelectTitle: string;
	modalSelectNote: string;
	modalSyncScopeName: string;
	modalSyncScopeDesc: string;
	scopeCurrent: string;
	scopeVault: string;
	modalFilterName: string;
	modalFilterPlaceholder: string;
	btnSelectAll: string;
	btnClear: string;
	btnCancel: string;
	btnReviewDiff: string;
	treeEmpty: string;
	selectionCount: (count: number, isCurrent: boolean) => string;
	noticeSelectAtLeastOne: string;
	noticeDiffError: (err: string) => string;

	// Diff Modal
	modalDiffTitle: string;
	modalDiffNote: string;
	btnBack: string;
	btnSyncAndPush: string;
	noticeKeepAtLeastOne: string;
	diffNoChange: string;

	// Status Modal
	statusModalTitle: (path: string) => string;
	statusModalEmpty: string;
}

export const en: TranslationDict = {
	cmdOpenSyncPanel: "Open sync panel",
	cmdSyncCurrentNote: "Sync current note",
	cmdSyncFullVault: "Sync full FireFly vault",
	ribbonTitle: "Open FireFly Sync",

	noticeCannotOpenRightLeaf: "Unable to open the FireFly Sync side panel.",
	noticeReadGitStatusFailed: (err) => `Failed to read blog Git status: ${err}`,
	noticeOpenSelectorFailed: (err) => `Unable to open sync selector: ${err}`,
	noticeSyncSuccess: (msg) => msg,
	noticeSyncFailed: (err) => `Sync failed: ${err}`,
	errDetachedHead: "Target blog repository is in a detached HEAD state. Please specify a branch in settings.",
	errDesktopOnly: "FireFly Sync only supports local desktop file system vaults.",
	errNoteNotFound: (path) => `Selected note does not exist: ${path}`,
	errNoteIgnored: (path) => `File is in an ignored folder and cannot be synced: ${path}`,
	errConfigRepoFirst: "Please configure the FireFly blog repository path in plugin settings (e.g. E:\\FireFly).",
	errFullVaultLayout: (path) => `Full vault sync requires a path structured as <workspace>\\firefly\\firefly. Current vault: ${path}`,
	errMissingObsidianDir: (path) => `Vault root missing configuration directory: ${path}`,
	errNoFilesToCommit: "No files to commit.",
	msgNoGitChanges: "No new Git changes detected, commit not created.",
	msgCommittedAndPushed: (count, remote, branchLabel, proxyLabel) =>
		`Committed ${count} files and pushed to ${remote}${branchLabel}${proxyLabel}.`,
	proxyLabel: (proxy) => ` (via proxy ${proxy})`,

	statusAdded: "Added",
	statusModified: "Modified",
	statusUntracked: "Untracked",
	statusDeleted: "Deleted",
	statusRenamed: "Renamed",
	statusConflicted: "Conflicted",
	statusUnchanged: "Unchanged",
	statusPending: "Pending",

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
	defaultCommitMsg: "Sync notes to FireFly",
	settingProxyName: "Network proxy",
	settingProxyDesc: "Optional. Used for Git push. Supports http://, https://, socks4://, socks5:// (e.g. socks5://127.0.0.1:7897). Leave blank for direct connection.",
	settingIgnoredFoldersName: "Vault ignored folders",
	settingIgnoredFoldersDesc: "Full vault mode will skip these folders, comma-separated. Default: current vault config directory.",
	dialogSelectDirectory: "Select Directory",

	settingContributeI18nName: "Contribute translation",
	settingContributeI18nDesc: "Help localize FireFly Sync into your language by submitting a translation or improvement on GitHub.",
	btnContributeI18n: "Contribute on GitHub",

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
	selectionCount: (count, isCurrent) =>
		`${count} notes selected${isCurrent ? " (active note default)" : ""}`,
	noticeSelectAtLeastOne: "Please select at least one note.",
	noticeDiffError: (err) => `Failed to generate diff: ${err}`,

	modalDiffTitle: "Review Git Diff",
	modalDiffNote: "Review git changes that will be copied and pushed to the FireFly blog. Uncheck any files to exclude.",
	btnBack: "Back",
	btnSyncAndPush: "Sync & Push",
	noticeKeepAtLeastOne: "Please keep at least one file selected.",
	diffNoChange: "No diff. Synchronizing this file will not alter content in the target repository.",

	statusModalTitle: (path) => `Git Change · ${path}`,
	statusModalEmpty: "No diff available to display.",
};

export const zh: TranslationDict = {
	cmdOpenSyncPanel: "打开同步面板",
	cmdSyncCurrentNote: "同步当前文章",
	cmdSyncFullVault: "同步整个 FireFly Vault",
	ribbonTitle: "打开 FireFly Sync",

	noticeCannotOpenRightLeaf: "无法打开右侧 FireFly Sync 面板。",
	noticeReadGitStatusFailed: (err) => `读取博客 Git 状态失败：${err}`,
	noticeOpenSelectorFailed: (err) => `无法打开同步选择器：${err}`,
	noticeSyncSuccess: (msg) => msg,
	noticeSyncFailed: (err) => `同步失败：${err}`,
	errDetachedHead: "当前博客仓库处于 detached HEAD 状态，请在设置中指定要推送的分支。",
	errDesktopOnly: "FireFly Sync 仅支持桌面端的本地文件系统 Vault。",
	errNoteNotFound: (path) => `选择的文章不存在：${path}`,
	errNoteIgnored: (path) => `该文件位于忽略目录，不能同步：${path}`,
	errConfigRepoFirst: "请先在插件设置中填写 FireFly 博客仓库路径，例如 E:\\FireFly。",
	errFullVaultLayout: (path) => `同步整个 Vault 要求目录为 <工作区>\\firefly\\firefly，例如 E:\\文档\\firefly\\firefly。当前 Vault：${path}`,
	errMissingObsidianDir: (path) => `Vault 根目录缺少配置目录：${path}`,
	errNoFilesToCommit: "没有可提交的文件。",
	msgNoGitChanges: "没有检测到新的 Git 修改，未创建提交。",
	msgCommittedAndPushed: (count, remote, branchLabel, proxyLabel) =>
		`已提交 ${count} 个文件并推送到 ${remote}${branchLabel}${proxyLabel}。`,
	proxyLabel: (proxy) => `（经代理 ${proxy}）`,

	statusAdded: "新增",
	statusModified: "修改",
	statusUntracked: "未跟踪",
	statusDeleted: "删除",
	statusRenamed: "重命名",
	statusConflicted: "冲突",
	statusUnchanged: "无变化",
	statusPending: "待比较",

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
	defaultCommitMsg: "同步文章到 FireFly",
	settingProxyName: "网络代理",
	settingProxyDesc: "可选。用于博客 Git 推送，支持 http://, https://, socks4://, socks5://（例如 socks5://127.0.0.1:7897 或 http://127.0.0.1:7890）。留空则直连。",
	settingIgnoredFoldersName: "Vault 忽略目录",
	settingIgnoredFoldersDesc: "整个 Vault 模式不会同步这些目录，逗号分隔。默认忽略当前配置目录。",
	dialogSelectDirectory: "请选择文件夹",

	settingContributeI18nName: "贡献翻译",
	settingContributeI18nDesc: "帮助我们将 FireFly Sync 翻译为更多语言，或改进现有词条。",
	btnContributeI18n: "前往 GitHub 贡献",

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
	selectionCount: (count, isCurrent) =>
		`${count} 篇文章已选择${isCurrent ? "（默认当前文章）" : ""}`,
	noticeSelectAtLeastOne: "请至少选择一篇文章。",
	noticeDiffError: (err) => `读取差异失败：${err}`,

	modalDiffTitle: "查看 Git 修改与差异",
	modalDiffNote: "这里显示复制到 FireFly 博客后将产生的 Git diff。左侧可取消勾选不需要同步的文件。",
	btnBack: "返回",
	btnSyncAndPush: "同步并推送",
	noticeKeepAtLeastOne: "请至少保留一个需要同步的文件。",
	diffNoChange: "没有差异。同步此文件不会改变目标博客中的内容。",

	statusModalTitle: (path) => `Git 修改 · ${path}`,
	statusModalEmpty: "当前没有可显示的差异。",
};

export const zhTW: TranslationDict = {
	...zh,
	cmdOpenSyncPanel: "開啟同步面板",
	cmdSyncCurrentNote: "同步當前文章",
	cmdSyncFullVault: "同步整個 FireFly Vault",
	ribbonTitle: "開啟 FireFly Sync",

	noticeCannotOpenRightLeaf: "無法開啟右側 FireFly Sync 面板。",
	noticeReadGitStatusFailed: (err) => `讀取部落格 Git 狀態失敗：${err}`,
	noticeOpenSelectorFailed: (err) => `無法開啟同步選擇器：${err}`,
	noticeSyncFailed: (err) => `同步失敗：${err}`,
	errDetachedHead: "當前部落格倉庫處於 detached HEAD 狀態，請在設定中指定要推送的分支。",
	errNoteNotFound: (path) => `選擇的文章不存在：${path}`,
	errNoteIgnored: (path) => `該檔案位於忽略目錄，不能同步：${path}`,
	errConfigRepoFirst: "請先在外掛程式設定中填寫 FireFly 部落格倉庫路徑，例如 E:\\FireFly。",
	errFullVaultLayout: (path) => `同步整個 Vault 要求目錄為 <工作區>\\firefly\\firefly。當前 Vault：${path}`,
	errMissingObsidianDir: (path) => `Vault 根目錄缺少配置目錄：${path}`,
	errNoFilesToCommit: "沒有可提交的檔案。",
	msgNoGitChanges: "沒有檢測到新的 Git 修改，未建立提交。",
	msgCommittedAndPushed: (count, remote, branchLabel, proxyLabel) =>
		`已提交 ${count} 個檔案並推送到 ${remote}${branchLabel}${proxyLabel}。`,
	proxyLabel: (proxy) => `（經代理 ${proxy}）`,

	statusAdded: "新增",
	statusModified: "修改",
	statusUntracked: "未追蹤",
	statusDeleted: "刪除",
	statusRenamed: "重命名",
	statusConflicted: "衝突",
	statusUnchanged: "無變化",
	statusPending: "待比較",

	viewTitle: "FireFly Sync",
	refreshAriaLabel: "重新整理 Git 狀態",
	settingsAriaLabel: "開啟 FireFly Sync 設定",
	repoPlaceholder: "請在設定中配置部落格倉庫路徑",
	btnSyncCurrent: "同步當前文章",
	btnSyncVault: "同步整個 Vault",
	headingBlogGitChanges: "部落格 Git 修改",
	sidebarTooltip: "選擇文章後會先預覽目標部落格的 Git diff；確認後只複製並提交勾選的檔案。",
	btnOpenSelector: "開啟同步選擇器",
	sidebarEmptyNoRepo: "配置部落格倉庫後，這裡會顯示 Git 工作區修改。",
	sidebarEmptyClean: "部落格 Git 工作區沒有修改。",

	settingsTitle: "FireFly Sync",
	settingsHeaderDesc: "配置本地 FireFly 部落格 Git 倉庫及文章、附件存放路徑。",
	settingRepoPathName: "部落格倉庫路徑",
	settingRepoPathDesc: "例如 E:\\FireFly。必須是已經初始化的 Git 倉庫。",
	btnBrowse: "瀏覽...",
	tooltipBrowseRepo: "選擇部落格倉庫根目錄",
	settingPostsPathName: "部落格文章存放目錄",
	settingPostsPathDesc: "相對於部落格倉庫的相對路徑，預設 src/content/posts。也可以點擊瀏覽選擇。",
	tooltipBrowsePosts: "選擇部落格文章存放目錄",
	settingImagesPathName: "部落格附件/圖片存放目錄",
	settingImagesPathDesc: "相對於部落格倉庫的相對路徑，預設 src/content/posts/images。也可以點擊瀏覽選擇。",
	tooltipBrowseImages: "選擇部落格附件/圖片存放目錄",
	settingRemoteName: "Git 遠端",
	settingRemoteDesc: "預設 origin。",
	settingBranchName: "推送分支",
	settingBranchDesc: "留空時使用當前檢出的分支。",
	settingCommitMsgName: "提交訊息",
	defaultCommitMsg: "同步文章到 FireFly",
	settingProxyName: "網路代理",
	settingProxyDesc: "可選。用於部落格 Git 推送，支援 http://, https://, socks4://, socks5://。留空則直連。",
	settingIgnoredFoldersName: "Vault 忽略目錄",
	settingIgnoredFoldersDesc: "整個 Vault 模式不會同步這些目錄，逗號分隔。預設忽略當前配置目錄。",
	dialogSelectDirectory: "請選擇資料夾",

	settingContributeI18nName: "貢獻翻譯",
	settingContributeI18nDesc: "協助我們將 FireFly Sync 翻譯為更多語言，或改進現有詞條。",
	btnContributeI18n: "前往 GitHub 貢獻",

	modalSelectTitle: "選擇同步內容",
	modalSelectNote: "以 Obsidian 檔案瀏覽器的目錄樹選擇文章。確認後會先顯示目標部落格的 Git 修改和差異。",
	modalSyncScopeName: "同步範圍",
	modalSyncScopeDesc: "當前文章預設只選中當前開啟的 Markdown；整個 Vault 會按目錄樹勾選所有可同步 Markdown。",
	scopeCurrent: "當前文章",
	scopeVault: "整個 Vault",
	modalFilterName: "篩選文章",
	modalFilterPlaceholder: "搜尋檔案或目錄...",
	btnSelectAll: "全選",
	btnClear: "清空",
	btnCancel: "取消",
	btnReviewDiff: "檢視選中差異",
	treeEmpty: "沒有符合條件的 Markdown 文章。",
	selectionCount: (count, isCurrent) =>
		`${count} 篇文章已選擇${isCurrent ? "（預設當前文章）" : ""}`,
	noticeSelectAtLeastOne: "請至少選擇一篇文章。",
	noticeDiffError: (err) => `讀取差異失敗：${err}`,

	modalDiffTitle: "檢視 Git 修改與差異",
	modalDiffNote: "這裡顯示複製到 FireFly 部落格後將產生的 Git diff。左側可取消勾選不需要同步的檔案。",
	btnBack: "返回",
	btnSyncAndPush: "同步並推送",
	noticeKeepAtLeastOne: "請至少保留一個需要同步的檔案。",
	diffNoChange: "沒有差異。同步此檔案不會改變目標部落格中的內容。",

	statusModalTitle: (path) => `Git 修改 · ${path}`,
	statusModalEmpty: "當前沒有可顯示的差異。",
};

export const ja: TranslationDict = {
	...en,
	cmdOpenSyncPanel: "同期パネルを開く",
	cmdSyncCurrentNote: "現在のノートを同期",
	cmdSyncFullVault: "FireFly Vault全体を同期",
	ribbonTitle: "FireFly Sync を開く",

	noticeCannotOpenRightLeaf: "FireFly Sync サイドパネルを開けません。",
	noticeReadGitStatusFailed: (err) => `ブログの Git 状態取得に失敗しました: ${err}`,
	noticeOpenSelectorFailed: (err) => `同期セレクターを開けません: ${err}`,
	noticeSyncFailed: (err) => `同期に失敗しました: ${err}`,
	errDetachedHead: "ブログリポジトリが detached HEAD 状態です。設定でブランチを指定してください。",
	errNoteNotFound: (path) => `選択したノートが見つかりません: ${path}`,
	errNoteIgnored: (path) => `このファイルは除外対象です: ${path}`,
	errConfigRepoFirst: "プラグイン設定でブログリポジトリのパスを指定してください（例: E:\\FireFly）。",
	errNoFilesToCommit: "コミットするファイルがありません。",
	msgNoGitChanges: "新しい変更は検出されませんでした。",
	msgCommittedAndPushed: (count, remote, branchLabel, proxyLabel) =>
		`${count} 件のファイルをコミットし、${remote}${branchLabel}${proxyLabel} にプッシュしました。`,
	proxyLabel: (proxy) => `（プロキシ経由: ${proxy}）`,

	statusAdded: "追加",
	statusModified: "変更",
	statusUntracked: "未追跡",
	statusDeleted: "削除",
	statusRenamed: "名前変更",
	statusConflicted: "競合",
	statusUnchanged: "変更なし",
	statusPending: "保留中",

	viewTitle: "FireFly Sync",
	refreshAriaLabel: "Git 状態を更新",
	settingsAriaLabel: "FireFly Sync 設定を開く",
	repoPlaceholder: "設定でブログリポジトリのパスを指定してください",
	btnSyncCurrent: "現在のノートを同期",
	btnSyncVault: "Vault全体を同期",
	headingBlogGitChanges: "ブログの Git 変更一覧",
	sidebarTooltip: "記事を選択して Git 差分を確認します。確認されたファイルのみコミットされます。",
	btnOpenSelector: "同期セレクターを開く",
	sidebarEmptyNoRepo: "ブログリポジトリ設定後に変更が表示されます。",
	sidebarEmptyClean: "作業ツリーに変更はありません。",

	settingsTitle: "FireFly Sync",
	settingsHeaderDesc: "ローカル FireFly ブログリポジトリ、記事および画像配置パスを設定します。",
	settingRepoPathName: "ブログリポジトリのパス",
	btnBrowse: "参照...",
	tooltipBrowseRepo: "リポジトリのルートフォルダを選択",
	settingPostsPathName: "記事配置フォルダ",
	tooltipBrowsePosts: "記事フォルダを選択",
	settingImagesPathName: "画像/メディアフォルダ",
	tooltipBrowseImages: "画像フォルダを選択",
	settingRemoteName: "Git リモート",
	settingBranchName: "プッシュブランチ",
	settingCommitMsgName: "コミットメッセージ",
	defaultCommitMsg: "ノートを FireFly に同期",
	settingProxyName: "ネットワークプロキシ",
	settingIgnoredFoldersName: "除外フォルダ",
	dialogSelectDirectory: "フォルダを選択",

	settingContributeI18nName: "翻訳に貢献する",
	settingContributeI18nDesc: "GitHub で FireFly Sync の翻訳を改善・追加してローカライズにご協力ください。",
	btnContributeI18n: "GitHub で貢献する",

	modalSelectTitle: "同期するノートを選択",
	modalSelectNote: "ツリーから同期するノートを選択してください。プッシュ前に Git 差分が表示されます。",
	modalSyncScopeName: "同期範囲",
	scopeCurrent: "現在のノート",
	scopeVault: "Vault全体",
	modalFilterName: "ノートを絞り込み",
	modalFilterPlaceholder: "ファイルやフォルダを検索...",
	btnSelectAll: "すべて選択",
	btnClear: "クリア",
	btnCancel: "キャンセル",
	btnReviewDiff: "差分を確認",
	treeEmpty: "該当するマークダウンノートがありません。",
	selectionCount: (count, isCurrent) =>
		`${count} 件のノートを選択中${isCurrent ? "（現在のノート）" : ""}`,
	noticeSelectAtLeastOne: "少なくとも1つのノートを選択してください。",
	noticeDiffError: (err) => `差分の生成に失敗しました: ${err}`,

	modalDiffTitle: "Git 差分の確認",
	modalDiffNote: "ブログにプッシュされる変更内容です。除外したいファイルのチェックを外してください。",
	btnBack: "戻る",
	btnSyncAndPush: "同期してプッシュ",
	noticeKeepAtLeastOne: "少なくとも1つのファイルを選択してください。",
	diffNoChange: "差分はありません。",

	statusModalTitle: (path) => `Git 変更 · ${path}`,
	statusModalEmpty: "表示できる差分はありません。",
};

// Map of all languages supported by Obsidian
export const translationsMap: Record<string, TranslationDict> = {
	en,
	zh,
	"zh-TW": zhTW,
	"zh-CN": zh,
	ja,
};

export function getAppLang(): string {
	try {
		const obs: ObsidianModule = typeof require === "function" ? require("obsidian") : {};
		return (obs.getLanguage ? obs.getLanguage() : "en") || "en";
	} catch {
		return "en";
	}
}

export function t(): TranslationDict {
	const lang = getAppLang();
	if (translationsMap[lang]) {
		return translationsMap[lang];
	}
	const prefix = lang.split("-")[0];
	if (prefix && translationsMap[prefix]) {
		return translationsMap[prefix];
	}
	return en;
}
