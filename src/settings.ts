import { App, PluginSettingTab, Setting } from "obsidian";
import type FireflySyncPlugin from "./main";
import { execFile } from "child_process";
import { promisify } from "util";
import { relative, resolve, sep } from "path";

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
	commitMessage: "同步 Obsidian 文章到 FireFly",
	proxyUrl: "",
	ignoreFolders: [".obsidian"],
};

export async function pickDirectory(defaultPath?: string): Promise<string | null> {
	// 1. Try electron dialog via Obsidian window.require
	try {
		const electron = (window as unknown as { require?: (mod: string) => any }).require?.("electron")
			?? (window as unknown as { electron?: any }).electron;
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
	} catch {}

	// 2. Fallback: PowerShell FolderBrowserDialog on Windows
	if (process.platform === "win32") {
		try {
			const initial = defaultPath ? defaultPath.replaceAll("\\", "\\\\") : "";
			const scriptLines = [
				"Add-Type -AssemblyName System.Windows.Forms",
				" = New-Object System.Windows.Forms.FolderBrowserDialog",
				".Description = '请选择文件夹'",
				initial ? `if (Test-Path \x27${initial}\x27) { $dialog.SelectedPath = \x27${initial}\x27 }` : "",
				"if (.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
				"    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
				"    Write-Output .SelectedPath",
				"}",
			].filter(Boolean).join("; ");
			const result = await execFileAsync("powershell", ["-NoProfile", "-NonInteractive", "-Command", scriptLines], {
				windowsHide: true,
				encoding: "utf8",
			});
			const path = (result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).pop();
			return path || null;
		} catch {}
	}

	// 3. Fallback: HTML input webkitdirectory
	return new Promise((resolveResult) => {
		const input = document.createElement("input");
		input.type = "file";
		input.setAttribute("webkitdirectory", "true");
		input.setAttribute("directory", "true");
		input.style.display = "none";
		document.body.appendChild(input);

		let resolved = false;
		input.addEventListener("change", () => {
			resolved = true;
			const file = input.files?.[0];
			if (!file) { document.body.removeChild(input); resolveResult(null); return; }
			const fullPath = (file as unknown as { path?: string })?.path;
			document.body.removeChild(input);
			if (fullPath) {
				const { dirname } = require("path");
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
				setTimeout(() => {
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
		containerEl.createEl("h2", { text: "FireFly Sync" });
		containerEl.createEl("p", {
			text: "配置本地 FireFly 博客 Git 仓库及文章、附件存放路径。",
			cls: "firefly-sync-setting-note",
		});

		// 1. 博客仓库根路径
		let repoTextInput: HTMLInputElement;
		new Setting(containerEl)
			.setName("博客仓库路径")
			.setDesc("例如 E:\\FireFly。必须是已经初始化的 Git 仓库。")
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
					.setButtonText("浏览...")
					.setTooltip("选择博客仓库根目录")
					.onClick(async () => {
						const selected = await pickDirectory(this.plugin.settings.blogRepositoryPath);
						if (selected) {
							this.plugin.settings.blogRepositoryPath = selected;
							repoTextInput.value = selected;
							await this.plugin.saveSettings();
						}
					}),
			);

		// 2. 博客文章存放目录
		let postsTextInput: HTMLInputElement;
		new Setting(containerEl)
			.setName("博客文章存放目录")
			.setDesc("相对于博客仓库的相对路径，默认 src/content/posts。也可以点击浏览选择。")
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
					.setButtonText("浏览...")
					.setTooltip("选择博客文章存放目录")
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

		// 3. 博客附件存放目录
		let imagesTextInput: HTMLInputElement;
		new Setting(containerEl)
			.setName("博客附件/图片存放目录")
			.setDesc("相对于博客仓库的相对路径，默认 src/content/posts/images。也可以点击浏览选择。")
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
					.setButtonText("浏览...")
					.setTooltip("选择博客附件/图片存放目录")
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
			.setName("Git 远端")
			.setDesc("默认 origin。")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.remote)
					.onChange(async (value) => {
						this.plugin.settings.remote = value.trim() || "origin";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("推送分支")
			.setDesc("留空时使用当前检出的分支。")
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
			.setName("提交信息")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.commitMessage)
					.onChange(async (value) => {
						this.plugin.settings.commitMessage = value.trim() || DEFAULT_SETTINGS.commitMessage;
						await this.plugin.saveSettings();
					}),
			);


		new Setting(containerEl)
			.setName("网络代理")
			.setDesc("可选。用于博客 Git 推送，支持 http://, https://, socks4://, socks5://（例如 socks5://127.0.0.1:7897 或 http://127.0.0.1:7890）。留空则直连。")
			.addText((text) =>
				text
					.setPlaceholder("socks5://127.0.0.1:7897")
					.setValue(this.plugin.settings.proxyUrl || "")
					.onChange(async (value) => {
						this.plugin.settings.proxyUrl = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Vault 忽略目录")
			.setDesc("整个 Vault 模式不会同步这些目录，逗号分隔。默认忽略 .obsidian。")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.ignoreFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.ignoreFolders = value
							.split(",")
							.map((folder) => folder.trim().replace(/^\/+|\/+$/g, ""))
							.filter(Boolean);
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
