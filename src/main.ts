import { t } from "./i18n";
import { access, stat } from "fs/promises";
import { FileSystemAdapter, ItemView, Notice, Plugin, WorkspaceLeaf, setIcon } from "obsidian";
import type { TFile } from "obsidian";
import { basename, dirname, extname, join } from "path";
import {
	assertGitRepository,
	commitAndPush,
	copyToBlog,
	getCurrentBranch,
	getGitStatuses,
	getSyncPreviews,
	gitErrorMessage,
	runGit,
	type GitFileStatus,
	type SyncPreview,
	type SyncPreviewInput,
} from "./git";
import { GitStatusModal, SyncSelectionModal } from "./modal";
import { DEFAULT_SETTINGS, FireflySyncSettingTab, type FireflySyncSettings } from "./settings";
import type { SelectionMode } from "./tree";

export const VIEW_TYPE_FIREFLY_SYNC = "firefly-sync-view";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"]);

interface VaultSyncFile extends SyncPreviewInput {
	vaultPath: string;
}

export default class FireflySyncPlugin extends Plugin {
	settings: FireflySyncSettings = DEFAULT_SETTINGS;
	statusByPath = new Map<string, GitFileStatus>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new FireflySyncSettingTab(this.app, this));

		this.addCommand({
			id: "open-sync-panel",
			name: t().cmdOpenSyncPanel,
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "sync-current-note",
			name: t().cmdSyncCurrentNote,
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) void this.openSelectionModal(file, "current");
				return true;
			},
		});
		this.addCommand({
			id: "sync-full-firefly-vault",
			name: t().cmdSyncFullVault,
			callback: () => void this.openSelectionModal(undefined, "vault"),
		});
		this.addRibbonIcon("git-pull-request", t().ribbonTitle, () => void this.activateView());
		this.registerView(VIEW_TYPE_FIREFLY_SYNC, (leaf) => new FireflySyncView(leaf, this));
		// Only refresh view when settings change or status updates, not on every leaf activation to preserve click events
	}

	onunload(): void {
		// Do not detach leaves in onunload to preserve leaf position chosen by the user
	}

	async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<FireflySyncSettings> | null;
		const cfgDir = this.app.vault.configDir;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, { ignoreFolders: [cfgDir] }, loaded ?? {});
		if (!this.settings.ignoreFolders || this.settings.ignoreFolders.length === 0) {
			this.settings.ignoreFolders = [cfgDir];
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		await this.refreshView();
	}

	async activateView(): Promise<void> {
		let leaf: WorkspaceLeaf | undefined = this.app.workspace.getLeavesOfType(VIEW_TYPE_FIREFLY_SYNC)[0];
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false) ?? undefined;
			if (!leaf) {
				new Notice(t().noticeCannotOpenRightLeaf);
				return;
			}
			await leaf.setViewState({ type: VIEW_TYPE_FIREFLY_SYNC, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
		await this.refreshGitStatus();
	}

	async refreshView(): Promise<void> {
		const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_FIREFLY_SYNC)[0]?.view;
		if (view instanceof FireflySyncView) view.render();
	}

	async refreshGitStatus(showError = true): Promise<void> {
		if (!this.settings.blogRepositoryPath.trim()) {
			this.statusByPath.clear();
			await this.refreshView();
			return;
		}
		try {
			const repository = await this.getBlogRepositoryRoot();
			const statuses = await getGitStatuses(repository);
			this.statusByPath = new Map(statuses.map((status) => [status.path, status]));
			await this.refreshView();
		} catch (error) {
			if (showError) new Notice(t().noticeReadGitStatusFailed(gitErrorMessage(error)));
		}
	}

	async openSelectionModal(currentFile?: TFile, mode: SelectionMode = "current"): Promise<void> {
		try {
			const repository = await this.getBlogRepositoryRoot();
			if (mode === "vault") await this.assertFullVaultLayout();

			const entries = this.app.vault
				.getMarkdownFiles()
				.filter((file) => !this.isIgnored(file.path))
				.map((file) => ({ path: file.path, name: file.name }));
			const statuses = await getGitStatuses(repository);
			this.statusByPath = new Map(statuses.map((status) => [status.path, status]));
			await this.refreshView();
			new SyncSelectionModal(
				this.app,
				entries,
				currentFile?.path,
				statuses,
				mode,
				(paths) => this.buildPreviews(paths, mode),
				(selectedPreviews) => this.syncFiles(selectedPreviews),
				this.getPostsPrefix(),
			).open();
		} catch (error) {
			new Notice(t().noticeOpenSelectorFailed(gitErrorMessage(error)));
		}
	}

	private async buildPreviews(paths: string[], mode: SelectionMode) {
		const repository = await this.getBlogRepositoryRoot();
		const files = await this.resolveAllSyncFiles(paths, mode);
		return getSyncPreviews(repository, files);
	}

	async syncFiles(previewsToSync: SyncPreview[]): Promise<void> {
		if (previewsToSync.length === 0) return;
		try {
			const repository = await this.getBlogRepositoryRoot();
			await copyToBlog(repository, previewsToSync);
			const branch = this.settings.branch || (await getCurrentBranch(repository));
			if (!branch) throw new Error(t().errDetachedHead);
			const message = await commitAndPush(
				repository,
				previewsToSync.map((file) => file.targetRelativePath),
				this.settings.commitMessage,
				this.settings.remote,
				branch,
				this.settings.proxyUrl,
			);
			new Notice(message, 8000);
			await this.refreshGitStatus(false);
		} catch (error) {
			new Notice(t().noticeSyncFailed(gitErrorMessage(error)), 10000);
			await this.refreshGitStatus(false);
		}
	}

	getPostsPrefix(): string {
		const p = (this.settings.blogPostsPath || DEFAULT_SETTINGS.blogPostsPath).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
		return p || "src/content/posts";
	}

	getImagesPrefix(): string {
		const p = (this.settings.blogImagesPath || DEFAULT_SETTINGS.blogImagesPath).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
		return p || "src/content/posts/images";
	}

	private async resolveAllSyncFiles(markdownPaths: string[], mode: SelectionMode): Promise<VaultSyncFile[]> {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error(t().errDesktopOnly);
		}
		const vaultBasePath = adapter.getBasePath();
		const allFiles = this.app.vault.getFiles();
		const filesByPath = new Map(allFiles.map((file) => [file.path, file]));

		const syncFiles: VaultSyncFile[] = [];
		const addedTargetPaths = new Set<string>();

		// 1. Resolve markdown files
		const uniqueMarkdownPaths = [...new Set(markdownPaths)];
		for (const path of uniqueMarkdownPaths) {
			const file = filesByPath.get(path);
			if (!file) throw new Error(`选择的文章不存在：`);
			if (this.isIgnored(path)) throw new Error(`该文件位于忽略目录，不能同步：`);
			const targetRelativePath = `${this.getPostsPrefix()}/${file.path.replaceAll("\\", "/")}`;
			syncFiles.push({
				vaultPath: path,
				sourceAbsolutePath: join(vaultBasePath, ...file.path.split("/")),
				targetRelativePath,
			});
			addedTargetPaths.add(targetRelativePath);
		}

		// 2. Resolve image files
		const imageFilesToSync: TFile[] = [];
		if (mode === "vault") {
			for (const file of allFiles) {
				const normPath = file.path.replaceAll("\\", "/");
				if (normPath.startsWith("images/") || normPath === "images") {
					if (IMAGE_EXTENSIONS.has(extname(file.path).toLowerCase()) || file.extension) {
						imageFilesToSync.push(file);
					}
				}
			}
		} else {
			const referencedImageFiles = new Set<TFile>();
			for (const mdPath of uniqueMarkdownPaths) {
				const mdFile = filesByPath.get(mdPath);
				if (!mdFile) continue;
				const content = await this.app.vault.read(mdFile);
				const imageRefs = this.extractImageReferences(content);
				for (const ref of imageRefs) {
					const linkedFile = this.app.metadataCache.getFirstLinkpathDest(ref, mdFile.path);
					if (linkedFile && IMAGE_EXTENSIONS.has(`.${linkedFile.extension}`.toLowerCase())) {
						referencedImageFiles.add(linkedFile);
					} else {
						const cleanRef = ref.replace(/^\.\//, "").replace(/^images\//, "");
						const candidate = filesByPath.get(`images/${cleanRef}`) || filesByPath.get(ref);
						if (candidate && IMAGE_EXTENSIONS.has(`.${candidate.extension}`.toLowerCase())) {
							referencedImageFiles.add(candidate);
						}
					}
				}
			}
			imageFilesToSync.push(...referencedImageFiles);
		}

		for (const imgFile of imageFilesToSync) {
			const normPath = imgFile.path.replaceAll("\\", "/");
			const relativeUnderImages = normPath.startsWith("images/")
				? normPath.slice("images/".length)
				: imgFile.name;
			const targetRelativePath = `${this.getImagesPrefix()}/${relativeUnderImages}`;
			if (!addedTargetPaths.has(targetRelativePath)) {
				syncFiles.push({
					vaultPath: imgFile.path,
				sourceAbsolutePath: join(vaultBasePath, ...imgFile.path.split("/")),
				targetRelativePath,
			});
				addedTargetPaths.add(targetRelativePath);
			}
		}

		return syncFiles;
	}

	private extractImageReferences(content: string): string[] {
		const results = new Set<string>();
		const wikiRegex = /!\[\[([^|\]\r\n]+)(?:\|[^\r\n\]]*)?\]\]/g;
		let match: RegExpExecArray | null;
		while ((match = wikiRegex.exec(content)) !== null) {
			const ref = match[1]?.trim();
			if (ref) results.add(ref);
		}
		const mdRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["\x27][^"\x27]*["\x27])?\)/g;
		while ((match = mdRegex.exec(content)) !== null) {
			const rawRef = match[1]?.trim().split("?")[0]?.split("#")[0];
			if (rawRef && !rawRef.startsWith("http://") && !rawRef.startsWith("https://") && !rawRef.startsWith("data:")) {
				results.add(rawRef);
			}
		}
		const htmlRegex = /<img\s+[^>]*?src=["\x27]([^"\x27]+)["\x27]/gi;
		while ((match = htmlRegex.exec(content)) !== null) {
			const rawRef = match[1]?.trim().split("?")[0]?.split("#")[0];
			if (rawRef && !rawRef.startsWith("http://") && !rawRef.startsWith("https://") && !rawRef.startsWith("data:")) {
				results.add(rawRef);
			}
		}
		return [...results];
	}

	private async getBlogRepositoryRoot(): Promise<string> {
		const configuredPath = this.settings.blogRepositoryPath.trim();
		if (!configuredPath) throw new Error(t().errConfigRepoFirst);
		await assertGitRepository(configuredPath);
		const repository = (await runGit(configuredPath, ["rev-parse", "--show-toplevel"])).trim();
		const postsDir = this.getPostsPrefix();
		await access(join(repository, ...postsDir.split("/")));
		return repository;
	}

	private async assertFullVaultLayout(): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error(t().errDesktopOnly);
		}
		const vaultPath = adapter.getBasePath();
		const folder = basename(vaultPath).toLocaleLowerCase();
		const parent = basename(dirname(vaultPath)).toLocaleLowerCase();
		if (folder !== "firefly" || parent !== "firefly") {
			throw new Error(t().errFullVaultLayout(vaultPath));
		}
		try {
			const cfgDir = this.app.vault.configDir;
			if (!(await stat(join(vaultPath, cfgDir))).isDirectory()) throw new Error("not a directory");
		} catch {
			throw new Error(t().errMissingObsidianDir(vaultPath));
		}
	}

	private isIgnored(path: string): boolean {
		const normalized = path.replaceAll("\\", "/");
		const dynamicIgnores = this.settings.ignoreFolders;
		return dynamicIgnores.some((folder) => {
			const cleaned = folder.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
			return cleaned.length > 0 && (normalized === cleaned || normalized.startsWith(`${cleaned}/`));
		});
	}
}

export class FireflySyncView extends ItemView {
	private readonly plugin: FireflySyncPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: FireflySyncPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_FIREFLY_SYNC;
	}

	getDisplayText(): string {
		return "FireFly Sync";
	}

	getIcon(): string {
		return "git-pull-request";
	}

	onOpen(): Promise<void> {
		this.render();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.contentEl.empty();
		return Promise.resolve();
	}

	render(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("firefly-sync-shell");
		const panel = container.createDiv({ cls: "firefly-sync-panel" });
		const toolbar = panel.createDiv({ cls: "firefly-sync-toolbar" });
		const icon = toolbar.createSpan({ cls: "firefly-sync-toolbar-icon" });
		setIcon(icon, "git-pull-request");
		toolbar.createSpan({ cls: "firefly-sync-title", text: "FireFly Sync" });
		const refresh = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t().refreshAriaLabel } });
		setIcon(refresh, "refresh-cw");
		refresh.addEventListener("click", () => void this.plugin.refreshGitStatus());
		const settings = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t().settingsAriaLabel } });
		setIcon(settings, "settings");
		settings.addEventListener("click", () => {
			const setting = (this.app as unknown as { setting?: { open: () => void; openTabById: (id: string) => void } }).setting;
			setting?.open();
			setting?.openTabById(this.plugin.manifest.id);
		});

		const repository = panel.createDiv({ cls: "firefly-sync-repository" });
		repository.setText(this.plugin.settings.blogRepositoryPath || t().repoPlaceholder);

		const actions = panel.createDiv({ cls: "firefly-sync-tabs" });
		const current = actions.createEl("button", { text: t().btnSyncCurrent, cls: "mod-cta" });
		current.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? undefined, "current"));
		const vault = actions.createEl("button", { text: t().btnSyncVault });
		vault.addEventListener("click", () => void this.plugin.openSelectionModal(undefined, "vault"));

		const heading = panel.createDiv({ cls: "firefly-sync-section-heading" });
		heading.createSpan({ text: t().headingBlogGitChanges });
		heading.createSpan({ cls: "firefly-sync-count", text: `${this.plugin.statusByPath.size}` });
		const tree = panel.createDiv({ cls: "firefly-sync-tree" });
		this.renderStatusTree(tree);

		const status = panel.createDiv({ cls: "firefly-sync-status" });
		status.createDiv({
			cls: "firefly-sync-status-line",
			text: t().sidebarTooltip,
		});
		const bottom = panel.createDiv({ cls: "firefly-sync-bottom" });
		const open = bottom.createEl("button", { text: t().btnOpenSelector, cls: "mod-cta" });
		open.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? undefined, "current"));
	}

	private renderStatusTree(parent: HTMLElement): void {
		if (!this.plugin.settings.blogRepositoryPath) {
			parent.createDiv({ cls: "firefly-sync-tree-empty", text: t().sidebarEmptyNoRepo });
			return;
		}
		const statuses = [...this.plugin.statusByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
		if (statuses.length === 0) {
			parent.createDiv({ cls: "firefly-sync-tree-empty", text: t().sidebarEmptyClean });
			return;
		}
		for (const gitStatus of statuses) {
			const row = parent.createDiv({ cls: "firefly-sync-tree-row" });
			row.createSpan({ cls: "firefly-sync-file-icon", text: "▤" });
			row.createSpan({ cls: "firefly-sync-file-name", text: gitStatus.path });
			row.createSpan({ cls: "firefly-sync-file-state", text: gitStatus.status });
			row.addEventListener("click", () => new GitStatusModal(this.app, gitStatus).open());
		}
	}
}
