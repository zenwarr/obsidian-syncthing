import * as child_process from 'child_process';
import * as path from "path";
import * as process from "process"
import {App, FileSystemAdapter, TFile} from 'obsidian';
import {PluginSettings} from "./settings";
import {MergeView} from "./mergeView";


export interface MergeTool {
	merge(latestFile: string, conflictFile: string): Promise<void>;
}


type execArguments = [program: string, args: string[]];

export abstract class ChildProcessMergeTool implements MergeTool {
	protected abstract getExecArguments(latestFile: string, conflictFile: string): execArguments;

	merge(latestFile: string, conflictFile: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const [file, args] = this.getExecArguments(latestFile, conflictFile);

			const proc = child_process.execFile(file, args, {
				env: {
					...process.env,
					"CONFLICT": conflictFile,
					"BASE": latestFile,
				}
			});

			proc.on("error", reject);
			proc.on("exit", code => {
				if (code !== 0) {
					reject(new Error(`Merge tool exited with code ${code}`))
					return
				}

				resolve();
			});
		})
	}
}


export class SublimeMergeMergeTool extends ChildProcessMergeTool {
	protected override getExecArguments(latestFile: string, conflictFile: string) {
		return ["smerge", ["mergetool", latestFile, conflictFile, "-o", latestFile]] as execArguments;
	}
}


export class MeldMergeTool extends ChildProcessMergeTool {
	protected override getExecArguments(latestFile: string, conflictFile: string) {
		return ["meld", [conflictFile, latestFile]] as execArguments;
	}
}


export class CustomMergeTool extends ChildProcessMergeTool {
	private settings: PluginSettings;

	constructor(settings: PluginSettings) {
		super()
		this.settings = settings;
	}

	protected override getExecArguments(latestFile: string, conflictFile: string) {
		if (!this.settings.customMergeTool) {
			throw new Error('No custom merge tool configured');
		}

		const parts = this.settings.customMergeTool.split(" ").filter(x => x !== "").map(x => {
			if (x === "$CONFLICT") {
				return conflictFile
			} else if (x === "$BASE") {
				return latestFile
			} else {
				return x
			}
		})
		return [parts[0], parts.slice(1)] as execArguments;
	}
}


export class InternalMergeTool implements MergeTool {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	private getFile(path: string): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			return null;
		}

		return file;
	}

	async merge(latestFile: string, conflictFile: string): Promise<void> {
		const leaf = this.app.workspace.getLeaf(true);

		const base = this.getFile(latestFile);
		if (!base) {
			throw new Error(`Could not find base file: ${latestFile}`)
		}

		const conflict = this.getFile(conflictFile);
		if (!conflict) {
			throw new Error(`Could not find conflict file: ${conflictFile}`)
		}

		const view = new MergeView(leaf, base, conflict);
		await leaf.open(view);
		this.app.workspace.setActiveLeaf(leaf)
	}
}


export async function runMergeTool(app: App, settings: PluginSettings, latestFile: string, conflictFile: string): Promise<void> {
	const adapter = app.vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) {
		console.error("Cannot resolve conflicts for non-filesystem vaults");
		return;
	}

	const vaultPath = adapter.getBasePath();
	const latestPath = path.join(vaultPath, latestFile);
	const conflictPath = path.join(vaultPath, conflictFile);

	switch (settings.mergeTool) {
		case "internal":
			return new InternalMergeTool(app).merge(latestFile, conflictFile);

		case "smerge":
			return new SublimeMergeMergeTool().merge(latestPath, conflictPath);

		case "meld":
			return new MeldMergeTool().merge(latestPath, conflictPath);

		case "custom":
			return new CustomMergeTool(settings).merge(latestPath, conflictPath);

		default:
			throw new Error(`Unknown merge tool: ${settings.mergeTool}`);
	}
}
