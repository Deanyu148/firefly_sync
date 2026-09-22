import { App, PluginSettingTab, Setting } from "obsidian";
import type FireflySyncPlugin from "./main";
import { execFile } from "child_process";
import { promisify } from "util";
import { dirname, relative, resolve, sep } from "path";
import { t } from "./i18n";

const execFileAsync = promisify(execFile);

export interface FireflySyncSettings {
	blogRepositoryPath: string;
	blogPostsPath: string;
	blogImagesPath: string;
	remote: string;
	branch: string;
	commitMessage: string;
	proxyUrl: string;
	ignoreFolders: string[];
}

export const DEFAULT_SETTINGS: FireflySyncSettings = {
	blogRepositoryPath: "",
	blogPostsPath: "src/content/posts",
	blogImagesPath: "src/content/posts/images",
	remote: "origin",
	branch: "",
	commitMessage: t().defaultCommitMsg,
	proxyUrl: "",
	ignoreFolders: [".obsidian"],
};

interface ElectronDialogResult {
	canceled: boolean;
	filePaths?: string[];
}

interface ElectronDialogApi {
	showOpenDialog?: (options: {
		defaultPath?: string;
		properties: string[];
	}) => Promise<ElectronDialogResult>;
}

interface WindowWithElectron {
	require?: (mod: string) => { dialog?: ElectronDialogApi; remote?: { dialog?: ElectronDialogApi } };
	electron?: { dialog?: ElectronDialogApi; remote?: { dialog?: ElectronDialogApi } };
}

export async function pickDirectory(defaultPath?: string): Promise<string | null> {
	// 1. Try electron dialog via Obsidian window
	try {
		const win = window as unknown as WindowWithElectron;
		const electron = win.require ? win.require("electron") : win.electron;
		const dialog = electron?.remote?.dialog ?? electron?.dialog;
		if (dialog?.showOpenDialog) {
			const res = await dialog.showOpenDialog({
				defaultPath: defaultPath || undefined,
				properties: ["openDirectory", "dontAddToRecent"],
			});
			if (!res.canceled && res.filePaths?.[0]) {
				return res.filePaths[0];
			}
			return null;
		}
	} catch (error) {
		console.debug("Electron folder dialog unavailable:", error);
	}

	// 2. Fallback: PowerShell FolderBrowserDialog on Windows
	if (process.platform === "win32") {
		try {
			const initial = defaultPath ? defaultPath.replaceAll("\\", "\\\\") : "";
			const scriptLines = [
				"Add-Type -AssemblyName System.Windows.Forms",
				"$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
				`$dialog.Description = '${t().dialogSelectDirectory}'`,
				initial ? `if (Test-Path '${initial}') { $dialog.SelectedPath = '${initial}' }` : "",
				"if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
				"    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
				"    Write-Output $dialog.SelectedPath",
				"}",
			].filter(Boolean).join("; ");
			const result = await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-Command", scriptLines], {
				windowsHide: true,
				encoding: "utf8",
			});
			const path = (result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).pop();
			return path || null;
		} catch (error) {
			console.debug("PowerShell folder dialog error:", error);
		}
	}

	// 3. Fallback: HTML input webkitdirectory using Obsidian createEl
	return new Promise((resolveResult) => {
		const input = createEl("input", {
			type: "file",
			cls: "firefly-sync-hidden-input",
			attr: {
				webkitdirectory: "true",
				directory: "true",
			},
		});
		input.setCssStyles({ display: "none" });
		document.body.appendChild(input);

		let resolved = false;
		input.addEventListener("change", () => {
			resolved = true;
			const file = input.files?.[0];
			if (!file) {
				document.body.removeChild(input);
				resolveResult(null);
				return;
			}
			const fullPath = (file as unknown as { path?: string })?.path;
			document.body.removeChild(input);
			if (fullPath) {
				const relativePath = file.webkitRelativePath;
				const depth = relativePath.split("/").length - 1;
				let current = dirname(fullPath);
				for (let i = 0; i < depth - 1; i++) {
					current = dirname(current);
				}
				resolveResult(current);
			} else {
				resolveResult(null);
			}
		});

		window.addEventListener(
			"focus",
			() => {
				window.setTimeout(() => {
					if (!resolved) {
						if (document.body.contains(input)) document.body.removeChild(input);
						resolveResult(null);
					}
				}, 1000);
			},
			{ once: true },
		);

		input.click();
	});
}

export class FireflySyncSettingTab extends PluginSettingTab {
	plugin: FireflySyncPlugin;

	constructor(app: App, plugin: FireflySyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName(t().settingsTitle)
			.setDesc(t().settingsHeaderDesc)
			.setHeading();

		// 1. Blog repository path
		let repoTextInput: HTMLInputElement;
		new Setting(containerEl)
			.setName(t().settingRepoPathName)
			.setDesc(t().settingRepoPathDesc)
			.addText((text) => {
				repoTextInput = text.inputEl;
				text
					.setPlaceholder("E:\\FireFly")
					.setValue(this.plugin.settings.blogRepositoryPath)
					.onChange(async (value) => {
						this.plugin.settings.blogRepositoryPath = value.trim();
						await this.plugin.saveSettings();
					});
			})
			.addButton((button) =>
				button
					.setButtonText(t().btnBrowse)
					.setTooltip(t().tooltipBrowseRepo)
					.onClick(async () => {
						const selected = await pickDirectory(this.plugin.settings.blogRepositoryPath);
						if (selected) {
							this.plugin.settings.blogRepositoryPath = selected;
							repoTextInput.value = selected;
							await this.plugin.saveSettings();
						}
					}),
			);

		// 2. Blog posts directory
		let postsTextInput: HTMLInputElement;
		new Setting(containerEl)
			.setName(t().settingPostsPathName)
			.setDesc(t().settingPostsPathDesc)
			.addText((text) => {
				postsTextInput = text.inputEl;
				text
					.setPlaceholder("src/content/posts")
					.setValue(this.plugin.settings.blogPostsPath || DEFAULT_SETTINGS.blogPostsPath)
					.onChange(async (value) => {
						this.plugin.settings.blogPostsPath = this.normalizeRelativePath(value.trim()) || DEFAULT_SETTINGS.blogPostsPath;
						await this.plugin.saveSettings();
					});
			})
			.addButton((button) =>
				button
					.setButtonText(t().btnBrowse)
					.setTooltip(t().tooltipBrowsePosts)
					.onClick(async () => {
						const repo = this.plugin.settings.blogRepositoryPath;
						const initial = repo ? resolve(repo, this.plugin.settings.blogPostsPath || "src/content/posts") : undefined;
						const selected = await pickDirectory(initial);
						if (selected) {
							const rel = this.computeRelativePath(repo, selected);
							this.plugin.settings.blogPostsPath = rel;
							postsTextInput.value = rel;
							await this.plugin.saveSettings();
						}
					}),
			);

		// 3. Blog images directory
		let imagesTextInput: HTMLInputElement;
		new Setting(containerEl)
			.setName(t().settingImagesPathName)
			.setDesc(t().settingImagesPathDesc)
			.addText((text) => {
				imagesTextInput = text.inputEl;
				text
					.setPlaceholder("src/content/posts/images")
					.setValue(this.plugin.settings.blogImagesPath || DEFAULT_SETTINGS.blogImagesPath)
					.onChange(async (value) => {
						this.plugin.settings.blogImagesPath = this.normalizeRelativePath(value.trim()) || DEFAULT_SETTINGS.blogImagesPath;
						await this.plugin.saveSettings();
					});
			})
			.addButton((button) =>
				button
					.setButtonText(t().btnBrowse)
					.setTooltip(t().tooltipBrowseImages)
					.onClick(async () => {
						const repo = this.plugin.settings.blogRepositoryPath;
						const initial = repo ? resolve(repo, this.plugin.settings.blogImagesPath || "src/content/posts/images") : undefined;
						const selected = await pickDirectory(initial);
						if (selected) {
							const rel = this.computeRelativePath(repo, selected);
							this.plugin.settings.blogImagesPath = rel;
							imagesTextInput.value = rel;
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName(t().settingRemoteName)
			.setDesc(t().settingRemoteDesc)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.remote)
					.onChange(async (value) => {
						this.plugin.settings.remote = value.trim() || "origin";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t().settingBranchName)
			.setDesc(t().settingBranchDesc)
			.addText((text) =>
				text
					.setPlaceholder("main")
					.setValue(this.plugin.settings.branch)
					.onChange(async (value) => {
						this.plugin.settings.branch = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t().settingCommitMsgName)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.commitMessage)
					.onChange(async (value) => {
						this.plugin.settings.commitMessage = value.trim() || DEFAULT_SETTINGS.commitMessage;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t().settingProxyName)
			.setDesc(t().settingProxyDesc)
			.addText((text) =>
				text
					.setPlaceholder("socks5://127.0.0.1:7897")
					.setValue(this.plugin.settings.proxyUrl || "")
					.onChange(async (value) => {
						this.plugin.settings.proxyUrl = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		const defaultIgnore = this.app.vault.configDir || ".obsidian";
		new Setting(containerEl)
			.setName(t().settingIgnoredFoldersName)
			.setDesc(t().settingIgnoredFoldersDesc)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.ignoreFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.ignoreFolders = value
							.split(",")
							.map((folder) => folder.trim().replace(/^\/+|\/+$/g, ""))
							.filter(Boolean);
						if (this.plugin.settings.ignoreFolders.length === 0) {
							this.plugin.settings.ignoreFolders = [defaultIgnore];
						}
						await this.plugin.saveSettings();
					}),
			);
	}

	private normalizeRelativePath(p: string): string {
		return p.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
	}

	private computeRelativePath(repoRoot: string, chosenPath: string): string {
		if (repoRoot) {
			const r = relative(resolve(repoRoot), resolve(chosenPath));
			if (!r.startsWith(".." + sep) && !r.includes(sep + "..")) {
				return r.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
			}
		}
		return this.normalizeRelativePath(chosenPath);
	}
}
