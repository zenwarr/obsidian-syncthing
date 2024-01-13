import {App, ButtonComponent, Modal, Notice, TFile} from "obsidian";
import {ConflictGroup} from "./files";
import {runMergeTool} from "./mergetool";
import {format, formatDistance} from "date-fns";
import {PluginSettings} from "./settings";

export class ConflictResolveModal extends Modal {
	private conflict: ConflictGroup;
	private settings: PluginSettings
	private conflictingFilesLeft: number;

	constructor(app: App, conflict: ConflictGroup, settings: PluginSettings) {
		super(app)
		this.conflict = conflict;
		this.conflictingFilesLeft = conflict.conflicts.length;
		this.settings = settings;
		this.titleEl.setText(`Conflicts for ${conflict.latestPath}`);
	}

	onOpen() {
		const deleteConflictingFile = async (file: TFile, div: HTMLElement) => {
			await this.app.vault.delete(file);
			div.remove();

			this.conflictingFilesLeft--;
			if (this.conflictingFilesLeft === 0) {
				this.close();
			}
		}

		for (const conflict of this.conflict.conflicts) {
			const conflictContainer = this.contentEl.createDiv({cls: "syncthing-conflict"});
			const info = conflictContainer.createDiv({cls: "syncthing-conflict__info"});
			info.createDiv({text: conflict.file.path, cls: "syncthing-conflict__path"});
			info.createDiv({text: formatConflictTime(conflict.name.date), cls: "syncthing-conflict__date"});

			const buttonContainer = conflictContainer.createDiv({cls: "syncthing-conflict__buttons"});
			conflictContainer.appendChild(buttonContainer);

			new ButtonComponent(buttonContainer).setButtonText("Merge").onClick(async () => {
				try {
					await runMergeTool(this.app.vault, this.settings, this.conflict.latestPath, conflict.file.path);
					const toolWaits = this.settings.mergeTool !== "custom" || this.settings.customMergeToolWaits;

					if (toolWaits && confirm("Delete the conflicting file?")) {
						await deleteConflictingFile(conflict.file, conflictContainer);
					}
				} catch (err) {
					console.error(err);
					new Notice("Merge tool run failed: " + err.message);
				}
			}).setClass("mod-cta");

			new ButtonComponent(buttonContainer).setButtonText("Delete").onClick(async () => {
				if (confirm("Delete the conflicting file?")) {
					await deleteConflictingFile(conflict.file, conflictContainer);
				}
			}).setClass("mod-warning");

			this.contentEl.appendChild(conflictContainer);
		}
	}
}

function formatConflictTime(time: Date): string {
	const abs = format(time, "yyyy-MM-dd HH:mm:ss");
	const rel = formatDistance(time, new Date(), {addSuffix: true});
	return `${abs} (${rel})`;
}
