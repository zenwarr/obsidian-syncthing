import {App, ButtonComponent, FileView, Menu, Modal, Notice, Plugin, TFile, View, WorkspaceLeaf} from 'obsidian';
import {ConflictGroup, getAllConflictGroups, getConflictGroupForFile, getConflictGroupLatestFile} from 'src/files';
import {runMergeTool} from "./src/mergetool";
import {SettingsTab} from "./src/settings";
import {format, formatDistance} from "date-fns";

interface PluginSettings {
	mergeTool: string;
	customMergeTool?: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	mergeTool: "meld",
}

export default class MyPlugin extends Plugin {
	settings: PluginSettings;
	conflictCountStatus: HTMLElement;
	onFileOpenBound: (file: TFile | null) => void;
	onFileChangedBound: (file: TFile) => void;
	onFileRenamedBound: (file: TFile, oldPath: string) => void;

	async onload() {
		await this.loadSettings();

		this.conflictCountStatus = this.addStatusBarItem();

		this.addCommand({
			id: 'show-conflicts',
			name: 'Show conflicts for the current file',
			callback: () => {
				this.showConflictsForCurrentFile();
			},
		});

		const addMenuItems = (menu: Menu, file: TFile) => {
			if (!(file instanceof TFile)) {
				return
			}

			const group = getConflictGroupForFile(this.app.vault, file);
			if (group.conflicts.length === 0) {
				return;
			}

			menu.addItem((item) => {
				item.setTitle("Show conflicts");
				item.setIcon("arrow-up-down");
				item.onClick(() => {
					new ConflictResolveModal(this.app, group, this.settings.mergeTool).open();
				});
			});
		}

		this.registerEvent(this.app.workspace.on("file-menu", addMenuItems));
		this.registerEvent(this.app.workspace.on("editor-menu", function (menu, editor, view) {
			if (!(view instanceof FileView)) {
				return;
			}

			addMenuItems.call(this, menu, view.file);
		}))

		this.addCommand({
			id: "show-all-conflicts",
			name: "Show all conflicts",
			callback: () => {
				new VaultConflictsModal(this.app, this.app.vault, this.settings.mergeTool).open();
			}
		});
		this.addRibbonIcon("arrow-up-down", "Show all conflicts in the vault", () => {
			new VaultConflictsModal(this.app, this.app.vault, this.settings.mergeTool).open();
		});

		this.addSettingTab(new SettingsTab(this.app, this));

		this.onFileOpenBound = this.onFileOpen.bind(this);
		this.app.workspace.on("file-open", this.onFileOpenBound);

		this.onFileChangedBound = this.onFileChanged.bind(this);
		this.onFileRenamedBound = (file: TFile, oldPath: string) => {
			this.onFileChanged(file);
			// todo: take into account old path too
		};
		this.app.vault.on("create", this.onFileChangedBound);
		this.app.vault.on("delete", this.onFileChangedBound);
		this.app.vault.on("rename", this.onFileRenamedBound);
	}

	onunload() {
		this.app.workspace.off("file-open", this.onFileOpenBound);
		this.app.vault.off("create", this.onFileChangedBound);
		this.app.vault.off("delete", this.onFileChangedBound);
		this.app.vault.off("rename", this.onFileRenamedBound);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	showConflictsForCurrentFile() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No file is open");
			return;
		}

		const group = getConflictGroupForFile(this.app.vault, file);
		if (group.conflicts.length === 0) {
			new Notice("No conflicts for the current file");
			return;
		}

		new ConflictResolveModal(this.app, group, this.settings.mergeTool).open();
	}

	onFileOpen(file: TFile | null) {
		if (!file) {
			return;
		}

		let group = getConflictGroupForFile(this.app.vault, file);
		const leaves = this.getLeavesForFile(file);
		for (const leaf of leaves) {
			this.updateConflictStatus(group, leaf);
		}
	}

	updateConflictStatus(group: ConflictGroup, leaf: WorkspaceLeaf) {
		const conflictCount = group.conflicts.length;

		const headerStatus = (leaf as any)?.tabHeaderStatusContainerEl;
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

	onFileChanged(file: TFile) {
		const updatedLatestFile = getConflictGroupLatestFile(file);

		this.app.workspace.iterateRootLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof FileView)) {
				return;
			}

			if (view.file == null) {
				return;
			}

			if (getConflictGroupLatestFile(view.file) == updatedLatestFile) {
				const group = getConflictGroupForFile(this.app.vault, view.file);
				this.updateConflictStatus(group, view.leaf)
			}
		});
	}

	getLeavesForFile(file: TFile): WorkspaceLeaf[] {
		let foundLeafs: WorkspaceLeaf[] = [];
		this.app.workspace.iterateRootLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof FileView)) {
				return;
			}

			if (view.file == null) {
				return;
			}

			if (view.file.path === file.path) {
				foundLeafs.push(leaf);
			}
		});

		return foundLeafs;
	}
}


function formatConflictTime(time: Date): string {
	const abs = format(time, "yyyy-MM-dd HH:mm:ss");
	const rel = formatDistance(time, new Date(), {addSuffix: true});
	return `${abs} (${rel})`;
}

class ConflictResolveModal extends Modal {
	private conflict: ConflictGroup;
	private mergeTool: string;
	private conflictingFilesLeft: number;

	constructor(app: App, conflict: ConflictGroup, mergeTool: string) {
		super(app)
		this.conflict = conflict;
		this.conflictingFilesLeft = conflict.conflicts.length;
		this.mergeTool = mergeTool;
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
					await runMergeTool(this.app.vault, this.mergeTool, this.conflict.latestPath, conflict.file.path);

					if (confirm("Delete the conflicting file?")) {
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


interface ExplorerView extends View {
	revealInFolder(file: TFile): void;
}

class VaultConflictsModal extends Modal {
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

				// const newLeaf = this.app.workspace.getLeaf(true);
				// await newLeaf.openFile(group.latest);
			});

			this.contentEl.appendChild(groupContainer);
		}
	}
}
