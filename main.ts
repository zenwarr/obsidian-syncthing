import {addIcon, FileView, Menu, Notice, Plugin, TFile, WorkspaceLeaf} from 'obsidian';
import {ConflictGroup, getConflictGroupForFile, getConflictGroupLatestFile} from 'src/files';
import {PluginSettings, SettingsTab} from "./src/settings";
import {ConflictResolveModal} from "./src/conflictResolveModal";
import {VaultConflictsModal} from "./src/vaultConflictsModal";
import {syncthingLogo} from "./src/logo";
import {MERGE_VIEW} from "./src/mergeView";

const DEFAULT_SETTINGS: PluginSettings = {
	mergeTool: "meld",
	customMergeToolWaits: true,
}

export default class SyncthingPlugin extends Plugin {
	settings: PluginSettings;
	onFileOpenBound: (file: TFile | null) => void;
	onFileChangedBound: (file: TFile) => void;
	onFileRenamedBound: (file: TFile, oldPath: string) => void;

	async onload() {
		await this.loadSettings();

		addIcon("syncthing-logo", syncthingLogo);

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
				item.setIcon("syncthing-logo");
				item.onClick(() => {
					new ConflictResolveModal(this.app, group, this.settings).open();
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
		this.addRibbonIcon("syncthing-logo", "Show all conflicts in the vault", () => {
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

		this.app.workspace.detachLeavesOfType(MERGE_VIEW);
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

		new ConflictResolveModal(this.app, group, this.settings).open();
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
