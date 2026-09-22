import { FileSystemAdapter, ItemView, Notice, Plugin, WorkspaceLeaf, setIcon } from "obsidian";
import type { TFile } from "obsidian";
import { basename, dirname, join } from "node:path";
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
	type SyncPreviewInput,
} from "./git";
import { GitStatusModal, SyncSelectionModal } from "./modal";
import { DEFAULT_SETTINGS, FireflySyncSettingTab, type FireflySyncSettings } from "./settings";
import type { SelectionMode } from "./tree";

export const VIEW_TYPE_FIREFLY_SYNC = "firefly-sync-view";
const BLOG_POSTS_PREFIX = "src/content/posts/";

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
			name: "打开同步面板",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "sync-current-note",
			name: "同步当前文章",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) void this.openSelectionModal(file, "current");
				return true;
			},
		});
		this.addCommand({
			id: "sync-full-firefly-vault",
			name: "同步整个 FireFly Vault",
			callback: () => void this.openSelectionModal(undefined, "vault"),
		});
		this.addRibbonIcon("git-pull-request", "打开 FireFly Sync", () => void this.activateView());
		this.registerView(VIEW_TYPE_FIREFLY_SYNC, (leaf) => new FireflySyncView(leaf, this));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshView()));
	}

	async onunload(): Promise<void> {
		await this.app.workspace.detachLeavesOfType(VIEW_TYPE_FIREFLY_SYNC);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
				new Notice("无法打开右侧 FireFly Sync 面板。");
				return;
			}
			await leaf.setViewState({ type: VIEW_TYPE_FIREFLY_SYNC, active: true });
		}
		this.app.workspace.revealLeaf(leaf);
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
			if (showError) new Notice(`读取博客 Git 状态失败：${gitErrorMessage(error)}`);
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
				(paths) => this.buildPreviews(paths),
				(paths) => this.syncSelected(paths),
			).open();
		} catch (error) {
			new Notice(`无法打开同步选择器：${gitErrorMessage(error)}`);
		}
	}

	private async buildPreviews(paths: string[]) {
		const repository = await this.getBlogRepositoryRoot();
		const files = await this.getVaultSyncFiles(paths);
		return getSyncPreviews(repository, files);
	}

	async syncSelected(paths: string[]): Promise<void> {
		if (paths.length === 0) return;
		try {
			const repository = await this.getBlogRepositoryRoot();
			const files = await this.getVaultSyncFiles(paths);
			await copyToBlog(repository, files);
			const branch = this.settings.branch || (await getCurrentBranch(repository));
			if (!branch) throw new Error("当前博客仓库处于 detached HEAD 状态，请在设置中指定要推送的分支。");
			const message = await commitAndPush(
				repository,
				files.map((file) => file.targetRelativePath),
				this.settings.commitMessage,
				this.settings.remote,
				branch,
			);
			new Notice(message, 8000);
			await this.refreshGitStatus(false);
		} catch (error) {
			new Notice(`同步失败：${gitErrorMessage(error)}`, 10000);
			await this.refreshGitStatus(false);
		}
	}

	private async getVaultSyncFiles(paths: string[]): Promise<VaultSyncFile[]> {
		const filesByPath = new Map(this.app.vault.getMarkdownFiles().map((file) => [file.path, file]));
		const uniquePaths = [...new Set(paths)];
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error("FireFly Sync 仅支持桌面端的本地文件系统 Vault。");
		}
		const vaultBasePath = adapter.getBasePath();
		return uniquePaths.map((path) => {
			const file = filesByPath.get(path);
			if (!file) throw new Error(`选择的文章不存在：${path}`);
			if (this.isIgnored(path)) throw new Error(`该文件位于忽略目录，不能同步：${path}`);
			return {
				vaultPath: path,
				sourceAbsolutePath: join(vaultBasePath, ...file.path.split("/")),
				targetRelativePath: `${BLOG_POSTS_PREFIX}${file.path.replaceAll("\\", "/")}`,
			};
		});
	}

	private async getBlogRepositoryRoot(): Promise<string> {
		const configuredPath = this.settings.blogRepositoryPath.trim();
		if (!configuredPath) throw new Error("请先在插件设置中填写 FireFly 博客仓库路径，例如 E:\\FireFly。");
		await assertGitRepository(configuredPath);
		const repository = (await runGit(configuredPath, ["rev-parse", "--show-toplevel"])).trim();
		const { access } = await import("node:fs/promises");
		await access(join(repository, "src", "content", "posts"));
		return repository;
	}

	private async assertFullVaultLayout(): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error("同步整个 Vault 仅支持桌面端的本地文件系统 Vault。");
		}
		const vaultPath = adapter.getBasePath();
		const folder = basename(vaultPath).toLocaleLowerCase();
		const parent = basename(dirname(vaultPath)).toLocaleLowerCase();
		if (folder !== "firefly" || parent !== "firefly") {
			throw new Error(
				`同步整个 Vault 要求目录为 <工作区>\\firefly\\firefly，例如 E:\\文档\\firefly\\firefly。当前 Vault：${vaultPath}`,
			);
		}
		const { stat } = await import("node:fs/promises");
		try {
			if (!(await stat(join(vaultPath, ".obsidian"))).isDirectory()) throw new Error("not a directory");
		} catch {
			throw new Error(`Vault 根目录缺少 .obsidian：${vaultPath}`);
		}
	}

	private isIgnored(path: string): boolean {
		const normalized = path.replaceAll("\\", "/");
		return this.settings.ignoreFolders.some((folder) => {
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
		const refresh = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "刷新 Git 状态" } });
		setIcon(refresh, "refresh-cw");
		refresh.addEventListener("click", () => void this.plugin.refreshGitStatus());
		const settings = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "打开 FireFly Sync 设置" } });
		setIcon(settings, "settings");
		settings.addEventListener("click", () => {
			const setting = (this.app as unknown as { setting?: { open: () => void; openTabById: (id: string) => void } }).setting;
			setting?.open();
			setting?.openTabById(this.plugin.manifest.id);
		});

		const repository = panel.createDiv({ cls: "firefly-sync-repository" });
		repository.setText(this.plugin.settings.blogRepositoryPath || "请在设置中配置博客仓库路径");

		const actions = panel.createDiv({ cls: "firefly-sync-tabs" });
		const current = actions.createEl("button", { text: "同步当前文章", cls: "mod-cta" });
		current.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? undefined, "current"));
		const vault = actions.createEl("button", { text: "同步整个 Vault" });
		vault.addEventListener("click", () => void this.plugin.openSelectionModal(undefined, "vault"));

		const heading = panel.createDiv({ cls: "firefly-sync-section-heading" });
		heading.createSpan({ text: "博客 Git 修改" });
		heading.createSpan({ cls: "firefly-sync-count", text: `${this.plugin.statusByPath.size}` });
		const tree = panel.createDiv({ cls: "firefly-sync-tree" });
		this.renderStatusTree(tree);

		const status = panel.createDiv({ cls: "firefly-sync-status" });
		status.createDiv({
			cls: "firefly-sync-status-line",
			text: "选择文章后会先预览目标文章的 Git diff；确认后只复制并提交勾选的 Markdown 文件。",
		});
		const bottom = panel.createDiv({ cls: "firefly-sync-bottom" });
		const open = bottom.createEl("button", { text: "打开同步选择器", cls: "mod-cta" });
		open.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? undefined, "current"));
	}

	private renderStatusTree(parent: HTMLElement): void {
		if (!this.plugin.settings.blogRepositoryPath) {
			parent.createDiv({ cls: "firefly-sync-tree-empty", text: "配置博客仓库后，这里会显示 Git 工作区修改。" });
			return;
		}
		const statuses = [...this.plugin.statusByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
		if (statuses.length === 0) {
			parent.createDiv({ cls: "firefly-sync-tree-empty", text: "博客 Git 工作区没有修改。" });
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
