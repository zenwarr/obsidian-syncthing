import {App, ButtonComponent, Modal, TFile, View} from "obsidian";
import {getAllConflictGroups} from "./files";

interface ExplorerView extends View {
	revealInFolder(file: TFile): void;
}

export class VaultConflictsModal extends Modal {
	private vault: any;
	private mergeTool: string;

	constructor(app: App, vault: any, mergeTool: string) {
		super(app)
		this.vault = vault;
		this.mergeTool = mergeTool;
		this.titleEl.setText("Vault conflicts");
	}

	onOpen() {
		const groups = getAllConflictGroups(this.vault);
		for (const group of groups.values()) {
			const groupContainer = this.contentEl.createDiv({cls: "syncthing-conflict-group"});

			const info = groupContainer.createDiv({cls: "syncthing-conflict-group__info"});
			info.createDiv({cls: "syncthing-conflict-group__path", text: group.latestPath});
			info.createDiv({
				cls: "syncthing-conflict-group__count",
				text: group.conflicts.length + " conflicts"
			});

			const buttonContainer = groupContainer.createDiv();
			buttonContainer.addClass("syncthing-conflict-group__button");
			groupContainer.appendChild(buttonContainer);

			new ButtonComponent(buttonContainer).setButtonText("Show").onClick(async () => {
				if (!group.latest) {
					return;
				}

				this.close();

				const fileExplorer = this.app.workspace.getLeavesOfType("file-explorer");
				for (const leaf of fileExplorer) {
					const view: ExplorerView = leaf.view as ExplorerView;
					view.revealInFolder(group.latest);
				}
			});

			this.contentEl.appendChild(groupContainer);
		}
	}
}
