import { App, PluginSettingTab, Setting } from "obsidian";
import type FireflySyncPlugin from "./main";

export interface FireflySyncSettings {
	blogRepositoryPath: string;
	remote: string;
	branch: string;
	commitMessage: string;
	ignoreFolders: string[];
}

export const DEFAULT_SETTINGS: FireflySyncSettings = {
	blogRepositoryPath: "",
	remote: "origin",
	branch: "",
	commitMessage: "同步 Obsidian 文章到 FireFly",
	ignoreFolders: [".obsidian", "images"],
};

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
			text: "配置本地 FireFly 博客 Git 仓库。插件只复制 Markdown 文章，不处理图片。",
			cls: "firefly-sync-setting-note",
		});

		new Setting(containerEl)
			.setName("博客仓库路径")
			.setDesc("例如 E:\\FireFly。必须是已经初始化的 Git 仓库。")
			.addText((text) =>
				text
					.setPlaceholder("E:\\FireFly")
					.setValue(this.plugin.settings.blogRepositoryPath)
					.onChange(async (value) => {
						this.plugin.settings.blogRepositoryPath = value.trim();
						await this.plugin.saveSettings();
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
			.setName("Vault 忽略目录")
			.setDesc("整个 Vault 模式不会同步这些目录，逗号分隔。默认忽略 .obsidian、images。")
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
}

