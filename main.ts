import {App, FileSystemAdapter, Notice, Plugin, PluginSettingTab, Setting, TFile, View} from 'obsidian';
import {ConflictGroup, getConflictGroupForFile} from 'src/files';
import * as path from 'path';
import {GolandMergeTool, MeldMergeTool, SublimeMergeMergeTool} from "./src/mergetool";

interface MyPluginSettings {
	mergeTool: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mergeTool: "smerge"
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	conflictCountStatus: HTMLElement;
	onFileOpen: (file: TFile | null) => void;

	async onload() {
		await this.loadSettings();

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		this.conflictCountStatus = this.addStatusBarItem();

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'resolve-conflicts',
			name: 'Resolve conflicts for the current file',
			editorCallback: () => {
				this.resolveCurrentFileConflicts();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.onFileOpen = (file: TFile | null) => {
			let group: ConflictGroup | null = null;
			if (file != null) {
				group = getConflictGroupForFile(this.app.vault, file);
			}

			const conflictCount = group != null ? group.conflicts.length : 0;

			this.conflictCountStatus.setText(`${conflictCount} conflicts`);
			if (conflictCount > 0) {
				new Notice(`This file has ${conflictCount} conflicts`);
				this.conflictCountStatus.setCssStyles({
					color: 'red',
				})
			} else {
				this.conflictCountStatus.setCssStyles({
					color: '',
				});
			}

			const headerStatus = (this.app.workspace.getActiveViewOfType(View)?.leaf as any)?.tabHeaderStatusContainerEl
			if (headerStatus != null) {
				if (conflictCount) {
					headerStatus.setText(`${conflictCount}`);
					headerStatus.setCssStyles({
						color: 'red',
					});
				} else {
					headerStatus.setText('');
					headerStatus.setCssStyles({
						color: '',
					});
				}
			}
		}
		this.app.workspace.on("file-open", this.onFileOpen);
	}

	onunload() {
		this.app.workspace.off("file-open", this.onFileOpen)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	resolveCurrentFileConflicts() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No file is open");
			return;
		}

		const group = getConflictGroupForFile(this.app.vault, file);
		console.log(group);
		if (group.conflicts.length === 0) {
			new Notice("No conflicts for the current file");
			return;
		}

		const conflict = group.conflicts[0];

		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			console.error("Cannot resolve conflicts for non-filesystem vaults");
			return;
		}

		this.runMergeTool(group.originalPath, conflict.file.path);
	}

	private async runMergeTool(originalFile: string, conflictFile: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			console.error("Cannot resolve conflicts for non-filesystem vaults");
			return;
		}

		const vaultPath = adapter.getBasePath();
		const originalPath = path.join(vaultPath, originalFile);
		const conflictPath = path.join(vaultPath, conflictFile);

		switch (this.settings.mergeTool) {
			case "smerge":
				return new SublimeMergeMergeTool().run(originalPath, conflictPath);

			case "goland":
				return new GolandMergeTool().run(originalPath, conflictPath);

			case "meld":
				return new MeldMergeTool().run(originalPath, conflictPath);

			default:
				throw new Error(`Unknown merge tool: ${this.settings.mergeTool}`);
		}
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Merge tool')
			.addDropdown(dropdown => {
				dropdown.addOption("smerge", "Sublime Merge");
				dropdown.addOption("goland", "GoLand");
				dropdown.addOption("meld", "Meld");
				dropdown.setValue(this.plugin.settings.mergeTool);
				dropdown.onChange(async (value) => {
					this.plugin.settings.mergeTool = value;
					await this.plugin.saveSettings();
				});
				return dropdown
			})
	}
}
