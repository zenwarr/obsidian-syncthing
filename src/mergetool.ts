import * as child_process from 'child_process';


export interface MergeTool {
	run(originalFile: string, conflictFile: string): Promise<void>;
}


export abstract class ChildProcessMergeTool {
	protected abstract getExecFile(): string;

	protected abstract getExecArguments(originalFile: string, conflictFile: string): string[];

	run(originalFile: string, conflictFile: string): Promise<void> {
		return new Promise((resolve, reject) => {
			child_process.execFile(
				this.getExecFile(),
				this.getExecArguments(originalFile, conflictFile),
				(error, stdout, stderr) => {
					if (error != null) {
						reject(error);
						return;
					}

					if (stdout) {
						console.log(stdout)
					}

					if (stderr) {
						console.error(stderr)
					}

					resolve();
				}
			)
		})
	}
}


export class GolandMergeTool extends ChildProcessMergeTool {
	protected getExecFile(): string {
		return "goland";
	}

	protected getExecArguments(originalFile: string, conflictFile: string): string[] {
		return ["merge", conflictFile, originalFile, originalFile, "--wait"];
	}
}


export class SublimeMergeMergeTool extends ChildProcessMergeTool {
	protected getExecFile(): string {
		return "smerge";
	}

	protected getExecArguments(originalFile: string, conflictFile: string): string[] {
		return ["mergetool", originalFile, conflictFile, "-o", conflictFile];
	}
}


export class MeldMergeTool extends ChildProcessMergeTool {
	protected getExecFile(): string {
		return "meld";
	}

	protected getExecArguments(originalFile: string, conflictFile: string): string[] {
		return [originalFile, conflictFile];
	}
}
