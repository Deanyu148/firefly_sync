import { t } from "./i18n";
import { App, Modal, Notice, Setting } from "obsidian";
import type { GitFileStatus } from "./git";
import type { SelectionMode } from "./tree";
import { buildTree, type SyncEntry, type SyncTreeNode } from "./tree";
import type { SyncPreview } from "./git";

export interface SyncDialogResult {
	mode: SelectionMode;
	paths: string[];
}

export type PreviewLoader = (paths: string[]) => Promise<SyncPreview[]>;
export type SyncSubmitter = (selectedPreviews: SyncPreview[]) => Promise<void>;

export class SyncSelectionModal extends Modal {
	private readonly entries: SyncEntry[];
	private readonly currentPath?: string;
	private readonly gitStatuses: Map<string, GitFileStatus>;
	private readonly defaultMode: SelectionMode;
	private readonly loadPreviews: PreviewLoader;
	private readonly onSubmit: SyncSubmitter;
	private readonly postsPrefix: string;
	private mode: SelectionMode;
	private selected = new Set<string>();
	private treeEl?: HTMLElement;
	private countEl?: HTMLElement;
	private searchQuery = "";
	private readonly collapsedPaths = new Set<string>();

	constructor(
		app: App,
		entries: SyncEntry[],
		currentPath: string | undefined,
		gitStatuses: GitFileStatus[],
		defaultMode: SelectionMode,
		loadPreviews: PreviewLoader,
		onSubmit: SyncSubmitter,
		postsPrefix: string = "src/content/posts",
	) {
		super(app);
		this.entries = entries;
		this.currentPath = currentPath;
		this.gitStatuses = new Map(gitStatuses.map((status) => [status.path, status]));
		this.defaultMode = defaultMode;
		this.mode = defaultMode;
		this.loadPreviews = loadPreviews;
		this.onSubmit = onSubmit;
		this.postsPrefix = postsPrefix.replace(/^\/+|\/+$/g, "");
		this.modalEl.addClass("firefly-sync-modal");
	}

	onOpen(): void {
		this.setTitle(t().modalSelectTitle);
		this.initializeSelection();
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.createEl("p", {
			text: t().modalSelectNote,
			cls: "firefly-sync-setting-note",
		});

		new Setting(container)
			.setName(t().modalSyncScopeName)
			.setDesc(t().modalSyncScopeDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("current", t().scopeCurrent)
					.addOption("vault", t().scopeVault)
					.setValue(this.mode)
					.onChange((value) => {
						this.mode = value as SelectionMode;
						this.initializeSelection();
						this.renderTree();
					}),
			);

		new Setting(container)
			.setName(t().modalFilterName)
			.addText((text) =>
				text.setPlaceholder(t().modalFilterPlaceholder).onChange((value) => {
					this.searchQuery = value.toLocaleLowerCase().trim();
					this.renderTree();
				}),
			);

		const actions = container.createDiv({ cls: "firefly-sync-selection-actions" });
		this.countEl = actions.createSpan();
		const selectAll = actions.createEl("button", { text: t().btnSelectAll });
		selectAll.addEventListener("click", () => {
			for (const entry of this.filteredEntries()) this.selected.add(entry.path);
			this.renderTree();
		});
		const clear = actions.createEl("button", { text: t().btnClear });
		clear.addEventListener("click", () => {
			this.selected.clear();
			this.renderTree();
		});

		this.treeEl = container.createDiv({ cls: "firefly-sync-tree" });
		this.renderTree();

		const buttons = container.createDiv({ cls: "modal-button-container" });
		const cancel = buttons.createEl("button", { text: t().btnCancel });
		cancel.addEventListener("click", () => this.close());
		const submit = buttons.createEl("button", { text: t().btnReviewDiff, cls: "mod-cta" });
		submit.addEventListener("click", () => void this.showDiffForSelection());
	}

	private initializeSelection(): void {
		const candidates = this.visibleEntries();
		if (this.mode === "current") {
			this.selected = new Set(
				this.currentPath && candidates.some((entry) => entry.path === this.currentPath)
					? [this.currentPath]
					: [],
			);
			return;
		}
		this.selected = new Set(candidates.map((entry) => entry.path));
	}

	private visibleEntries(): SyncEntry[] {
		if (this.mode === "vault") return this.entries;
		return this.currentPath ? this.entries.filter((entry) => entry.path === this.currentPath) : [];
	}

	private filteredEntries(): SyncEntry[] {
		if (!this.searchQuery) return this.visibleEntries();
		return this.visibleEntries().filter((entry) => entry.path.toLocaleLowerCase().includes(this.searchQuery));
	}

	private renderTree(): void {
		if (!this.treeEl) return;
		this.treeEl.empty();
		const entries = this.filteredEntries();
		if (entries.length === 0) {
			this.treeEl.createDiv({ cls: "firefly-sync-tree-empty", text: t().treeEmpty });
			this.updateSelectionCount();
			return;
		}
		const root = buildTree(entries);
		this.renderChildren(this.treeEl, root.children, 0);
		this.updateSelectionCount();
	}

	private renderChildren(parent: HTMLElement, children: SyncTreeNode[], depth: number): void {
		for (const node of children) this.renderNode(parent, node, depth);
	}

	private renderNode(parent: HTMLElement, node: SyncTreeNode, depth: number): void {
		const row = parent.createDiv({ cls: "firefly-sync-tree-row" });
		row.style.paddingLeft = `${depth * 16 + 4}px`;
		const descendantPaths = this.getLeafPaths(node);
		const checkedCount = descendantPaths.filter((path) => this.selected.has(path)).length;
		const checked = descendantPaths.length > 0 && checkedCount === descendantPaths.length;
		if (checked) row.addClass("is-selected");

		if (!node.isFile) {
			const toggle = row.createSpan({ cls: "collapse-icon", text: this.collapsedPaths.has(node.path ?? "") ? "▸" : "▾" });
			toggle.addEventListener("click", (event) => {
				event.stopPropagation();
				this.toggleCollapsed(node.path ?? "");
			});
		} else {
			row.createSpan({ cls: "collapse-icon", text: " " });
		}

		const checkbox = row.createEl("input", { type: "checkbox" });
		checkbox.checked = checked;
		checkbox.indeterminate = checkedCount > 0 && !checked;
		checkbox.addEventListener("click", (event) => event.stopPropagation());
		checkbox.addEventListener("change", () => {
			for (const path of descendantPaths) {
				if (checkbox.checked) this.selected.add(path);
				else this.selected.delete(path);
			}
			this.renderTree();
		});

		row.createSpan({ cls: "firefly-sync-file-icon", text: node.isFile ? "▤" : "▰" });
		row.createSpan({ cls: "firefly-sync-file-name", text: node.name });
		if (node.isFile && node.path) {
			const status = this.gitStatuses.get(this.statusKey(node.path));
			row.createSpan({ cls: "firefly-sync-file-state", text: status?.status ?? t().statusPending });
			row.addEventListener("dblclick", () => void this.showSingleDiff(node.path!));
		} else {
			row.createSpan({ cls: "firefly-sync-file-state", text: `${descendantPaths.length}` });
		}
		row.addEventListener("click", () => {
			if (node.isFile) {
				const path = node.path;
				if (!path) return;
				if (this.selected.has(path)) this.selected.delete(path);
				else this.selected.add(path);
				this.renderTree();
			} else {
				this.toggleCollapsed(node.path ?? "");
			}
		});

		if (!node.isFile && !this.collapsedPaths.has(node.path ?? "")) {
			this.renderChildren(parent, node.children, depth + 1);
		}
	}

	private statusKey(vaultPath: string): string {
		return `src/content/posts/${vaultPath}`;
	}

	private getLeafPaths(node: SyncTreeNode): string[] {
		if (node.isFile) return node.path ? [node.path] : [];
		return node.children.flatMap((child) => this.getLeafPaths(child));
	}

	private toggleCollapsed(path: string): void {
		if (this.collapsedPaths.has(path)) this.collapsedPaths.delete(path);
		else this.collapsedPaths.add(path);
		this.renderTree();
	}

	private updateSelectionCount(): void {
		this.countEl?.setText(t().selectionCount(this.selected.size, this.defaultMode === "current"));
	}

	private async showSingleDiff(path: string): Promise<void> {
		try {
			const previews = await this.loadPreviews([path]);
			new DiffReviewModal(this.app, previews, this.onSubmit).open();
		} catch (error) {
			new Notice(t().noticeDiffError(error instanceof Error ? error.message : String(error)));
		}
	}

	private async showDiffForSelection(): Promise<void> {
		const paths = [...this.selected].sort();
		if (paths.length === 0) {
			new Notice(t().noticeSelectAtLeastOne);
			return;
		}
		try {
			const previews = await this.loadPreviews(paths);
			new DiffReviewModal(this.app, previews, this.onSubmit).open();
		} catch (error) {
			new Notice(t().noticeDiffError(error instanceof Error ? error.message : String(error)));
		}
	}
}

export class DiffReviewModal extends Modal {
	private readonly previews: SyncPreview[];
	private readonly onSubmit: SyncSubmitter;
	private selected = new Set<string>();
	private listEl?: HTMLElement;
	private diffEl?: HTMLElement;

	constructor(app: App, previews: SyncPreview[], onSubmit: SyncSubmitter) {
		super(app);
		this.previews = previews;
		this.onSubmit = onSubmit;
		this.selected = new Set(previews.map((preview) => preview.targetRelativePath));
		this.modalEl.addClass("firefly-sync-modal");
	}

	onOpen(): void {
		this.setTitle(t().modalDiffTitle);
		this.render();
		if (this.previews[0]) this.renderPreview(this.previews[0]);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const container = this.contentEl;
		container.empty();
		container.createEl("p", {
			text: t().modalDiffNote,
			cls: "firefly-sync-setting-note",
		});
		const layout = container.createDiv({ cls: "firefly-sync-diff-layout" });
		this.listEl = layout.createDiv({ cls: "firefly-sync-diff-list" });
		this.diffEl = layout.createDiv({ cls: "firefly-sync-diff" });
		this.renderList();

		const buttons = container.createDiv({ cls: "modal-button-container" });
		const cancel = buttons.createEl("button", { text: t().btnBack });
		cancel.addEventListener("click", () => this.close());
		const submit = buttons.createEl("button", { text: t().btnSyncAndPush, cls: "mod-cta" });
		submit.addEventListener("click", () => {
			const paths = [...this.selected].sort();
			if (paths.length === 0) {
				new Notice(t().noticeKeepAtLeastOne);
				return;
			}
			this.close();
			const selectedPreviews = this.previews.filter((preview) => this.selected.has(preview.targetRelativePath));
			void this.onSubmit(selectedPreviews);
		});
	}

	private renderList(): void {
		if (!this.listEl) return;
		this.listEl.empty();
		for (const preview of this.previews) {
			const row = this.listEl.createDiv({ cls: "firefly-sync-tree-row" });
			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selected.has(preview.targetRelativePath);
			checkbox.addEventListener("click", (event) => event.stopPropagation());
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) this.selected.add(preview.targetRelativePath);
				else this.selected.delete(preview.targetRelativePath);
			});
			row.createSpan({ cls: "firefly-sync-file-name", text: preview.targetRelativePath });
			row.createSpan({ cls: "firefly-sync-file-state", text: preview.statusLabel });
			row.addEventListener("click", () => this.renderPreview(preview));
		}
	}

	private renderPreview(preview: SyncPreview): void {
		if (!this.diffEl) return;
		this.diffEl.empty();
		this.diffEl.createEl("div", {
			cls: "firefly-sync-diff-title",
			text: `${preview.targetRelativePath}  ·  ${preview.statusLabel}`,
		});
		if (!preview.diff) {
			this.diffEl.createEl("div", {
				text: t().diffNoChange,
				cls: "firefly-sync-setting-note",
			});
			return;
		}
		for (const line of preview.diff.replace(/\r\n/g, "\n").split("\n")) {
			const lineEl = this.diffEl.createDiv({ cls: "firefly-sync-diff-line", text: line || " " });
			if (line.startsWith("+") && !line.startsWith("+++")) lineEl.addClass("is-add");
			if (line.startsWith("-") && !line.startsWith("---")) lineEl.addClass("is-remove");
			if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("---") || line.startsWith("+++")) {
				lineEl.addClass("is-header");
			}
		}
	}
}

export class GitStatusModal extends Modal {
	private readonly status: GitFileStatus;

	constructor(app: App, status: GitFileStatus) {
		super(app);
		this.status = status;
		this.modalEl.addClass("firefly-sync-modal");
	}

	onOpen(): void {
		this.setTitle(t().statusModalTitle(this.status.path));
		const diff = this.contentEl.createDiv({ cls: "firefly-sync-diff" });
		if (!this.status.diff) {
			diff.setText(t().statusModalEmpty);
			return;
		}
		for (const line of this.status.diff.replace(/\r\n/g, "\n").split("\n")) {
			const lineEl = diff.createDiv({ cls: "firefly-sync-diff-line", text: line || " " });
			if (line.startsWith("+") && !line.startsWith("+++")) lineEl.addClass("is-add");
			if (line.startsWith("-") && !line.startsWith("---")) lineEl.addClass("is-remove");
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
