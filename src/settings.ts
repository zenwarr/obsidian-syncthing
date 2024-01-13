import {App, PluginSettingTab, Setting} from "obsidian";
import SyncthingPlugin from "../main";

export interface PluginSettings {
	mergeTool: string;
	customMergeTool?: string;
	customMergeToolWaits: boolean;
}

export class SettingsTab extends PluginSettingTab {
	plugin: SyncthingPlugin;

	constructor(app: App, plugin: SyncthingPlugin) {
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
				dropdown.addOption("meld", "Meld");
				dropdown.addOption("internal", "Internal");
				dropdown.addOption("custom", "Custom");
				dropdown.setValue(this.plugin.settings.mergeTool);
				dropdown.onChange(async (value) => {
					this.plugin.settings.mergeTool = value;
					await this.plugin.saveSettings();
				});
				return dropdown
			})

		new Setting(containerEl)
			.setName('Custom merge tool')
			.setDesc('If you want to use a custom merge tool, enter the path to the executable here.')
			.addText(text => {
				text.setPlaceholder("e.g. /usr/bin/meld");
				text.setValue(this.plugin.settings.customMergeTool || "");
				text.onChange(async (value) => {
					this.plugin.settings.customMergeTool = value;
					await this.plugin.saveSettings();
				});
				return text
			})

		new Setting(containerEl)
			.setName('Custom merge tool waits')
			.setDesc('If your custom merge tool waits for the merge to be finished before exiting, enable this option.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.customMergeToolWaits);
				toggle.onChange(async (value) => {
					this.plugin.settings.customMergeToolWaits = value;
					await this.plugin.saveSettings();
				});
				return toggle
			})
	}
}
