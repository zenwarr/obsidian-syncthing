import * as child_process from 'child_process';
import * as path from "path";
import {FileSystemAdapter, Vault} from 'obsidian';


export interface MergeTool {
	merge(latestFile: string, conflictFile: string): Promise<void>;
}


type execArguments = [program: string, args: string[]];

export abstract class ChildProcessMergeTool implements MergeTool {
	protected abstract getExecArguments(latestFile: string, conflictFile: string): execArguments;

	merge(latestFile: string, conflictFile: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const [file, args] = this.getExecArguments(latestFile, conflictFile);

			const proc = child_process.execFile(file, args,);

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


export class GolandMergeTool extends ChildProcessMergeTool {
	protected override getExecArguments(latestFile: string, conflictFile: string) {
		return ["writerside", ["merge", latestFile, conflictFile, latestFile, "--wait"]] as execArguments;
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

export async function runMergeTool(vault: Vault, mergeTool: string, latestFile: string, conflictFile: string): Promise<void> {
	const adapter = vault.adapter;
	if (!(adapter instanceof FileSystemAdapter)) {
		console.error("Cannot resolve conflicts for non-filesystem vaults");
		return;
	}

	const vaultPath = adapter.getBasePath();
	const latestPath = path.join(vaultPath, latestFile);
	const conflictPath = path.join(vaultPath, conflictFile);

	switch (mergeTool) {
		case "smerge":
			return new SublimeMergeMergeTool().merge(latestPath, conflictPath);

		case "goland":
			return new GolandMergeTool().merge(latestPath, conflictPath);

		case "meld":
			return new MeldMergeTool().merge(latestPath, conflictPath);

		default:
			throw new Error(`Unknown merge tool: ${mergeTool}`);
	}
}
