import {ButtonComponent, ItemView, TFile, WorkspaceLeaf} from "obsidian";
import {MergeView as CodemirrorMergeView} from "@codemirror/merge";
import {createMergeEditor} from "./merge";

export const MERGE_VIEW = "syncthing-conflict-merge-view";

export class MergeView extends ItemView {
	private mergeEditor: CodemirrorMergeView
	private base: TFile
	private conflict: TFile

	constructor(leaf: WorkspaceLeaf, base: TFile, conflict: TFile) {
		super(leaf);
		this.base = base;
		this.conflict = conflict;
	}

	override getViewType(): string {
		return MERGE_VIEW;
	}


	override async onOpen(): Promise<void> {
		const baseContent = await this.app.vault.read(this.base);
		const conflictContent = await this.app.vault.read(this.conflict);

		const container = this.contentEl.createDiv({cls: "syncthing-merge__container"});
		const editor = container.createDiv({cls: "syncthing-merge__editor"});

		const buttons = container.createDiv({cls: "syncthing-merge__buttons"});
		new ButtonComponent(buttons).setButtonText("Save and delete conflict").onClick(async () => {
			await this.save(true)
		});
		new ButtonComponent(buttons).setButtonText("Save and keep conflict").onClick(async () => {
			await this.save(false)
		});
		new ButtonComponent(buttons).setButtonText("Discard").onClick(() => {
			if (!confirm("Really discard all changes?")) {
				return;
			}

			this.app.workspace.detachLeavesOfType(MERGE_VIEW); // todo: close current only
		});

		this.mergeEditor = createMergeEditor(editor, baseContent, conflictContent);
	}


	private async save(deleteConflict: boolean) {
		// todo: need to go to the next conflict in group

		const updatedContent = this.mergeEditor.a.state.doc.toString();
		await this.app.vault.modify(this.base, updatedContent);
		if (deleteConflict) {
			await this.app.vault.delete(this.conflict);
		}
		this.app.workspace.detachLeavesOfType(MERGE_VIEW); // todo: close current only
	}


	override async onClose() {
		this.mergeEditor.destroy();
	}


	override getDisplayText(): string {
		return `Merge: ${this.base.basename} and ${this.conflict.basename}`;
	}


	// override setViewData(data: string): void {
	// 	console.log("setting view data: ", data)
	// 	this.editorData = data
	// }
	//
	//
	// override getViewData(): string {
	// 	console.log("getting view data")
	// 	return this.editorData
	// }


	// override clear() {
	// 	// do nothing
	// }
}
