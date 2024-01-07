import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "../main";

export class SettingsTab extends PluginSettingTab {
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
	}
}
