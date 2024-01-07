import * as path from "path";
import {TAbstractFile, TFile, Vault} from "obsidian";

export interface ConflictGroup {
	latestPath: string;
	latest: TFile | null;
	conflicts: {
		name: ParsedConflictName;
		file: TFile;
	}[];
}

const regexp = /(?<baseName>.*)\.sync-conflict-(?<date>\d{8}-\d{6})-(?<device>.*)/;

function isConflict(file: TFile): boolean {
	return regexp.test(file.basename);
}

function getLatestFilePath(file: TFile, parsed: ParsedConflictName): string {
	return path.join(path.dirname(file.path), parsed.latestName);
}

function sortConflicts(conflicts: ConflictGroup["conflicts"]) {
	conflicts.sort((a, b) => {
		return a.name.date.getTime() - b.name.date.getTime();
	});
}

export function getAllConflictGroups(vault: Vault): Map<string, ConflictGroup> {
	const groups = new Map<string, ConflictGroup>();

	const allFiles = vault.getFiles();
	for (const file of allFiles) {
		if (isConflict(file)) {
			const parsedConflictName = parseConflictName(file);
			const latestFilePath = getLatestFilePath(file, parsedConflictName);
			const latestFile = vault.getAbstractFileByPath(latestFilePath);

			if (!groups.has(latestFilePath)) {
				groups.set(latestFilePath, {
					latestPath: latestFilePath,
					latest: asTFile(latestFile),
					conflicts: [{
						name: parsedConflictName,
						file: file,
					}]
				});
			} else {
				const conflict = groups.get(latestFilePath)!;
				conflict.conflicts.push({
					name: parsedConflictName,
					file: file,
				});
			}
		}
	}

	for (const group of groups.values()) {
		sortConflicts(group.conflicts);
	}
	return groups;
}

function asTFile(file: TAbstractFile | null): TFile | null {
	if (!file) {
		return null;
	}

	if (file instanceof TFile) {
		return file;
	}

	return null;
}

export function getConflictGroupForFile(vault: Vault, file: TFile): ConflictGroup {
	let latestFilePath: string;
	let latestFile: TFile | null;
	if (isConflict(file)) {
		const parsed = parseConflictName(file);
		latestFilePath = getLatestFilePath(file, parsed);
		latestFile = asTFile(vault.getAbstractFileByPath(latestFilePath));
	} else {
		latestFilePath = file.path;
		latestFile = file;
	}

	const group: ConflictGroup = {
		latestPath: latestFilePath,
		latest: latestFile,
		conflicts: [],
	}

	const parent = file.parent || vault.getRoot();
	for (const aChild of parent.children) {
		const child = asTFile(aChild);
		if (child == null || child.path === latestFilePath || !isConflict(child)) {
			continue
		}

		const parsed = parseConflictName(child);
		const curLatestFilePath = getLatestFilePath(child, parsed);
		if (curLatestFilePath === latestFilePath) {
			group.conflicts.push({
				name: parsed,
				file: child,
			});
		}
	}

	sortConflicts(group.conflicts);
	return group;
}

export interface ParsedConflictName {
	latestName: string;
	date: Date;
	device: string;
}

function parseConflictName(file: TFile): ParsedConflictName {
	// file name has pattern: BASENAME.sync-conflict-20230710-123718-FUZ2JB4
	const match = file.basename.match(regexp);
	if (!match) {
		throw new Error("Invalid sync conflict filename");
	}

	const baseName = match.groups?.["baseName"];
	const date = match.groups?.["date"];
	const device = match.groups?.["device"];

	const d = date ? new Date(
		parseInt(date.substring(0, 4)),
		parseInt(date.substring(4, 6)) - 1,
		parseInt(date.substring(6, 8)),
		parseInt(date.substring(9, 11)),
		parseInt(date.substring(11, 13)),
		parseInt(date.substring(13, 15)),
	) : new Date();

	return {
		latestName: (baseName || "") + "." + file.extension ?? "",
		date: d,
		device: device ?? "",
	}
}

export function getConflictGroupLatestFile(file: TFile): string {
	if (isConflict(file)) {
		const parsed = parseConflictName(file);
		return getLatestFilePath(file, parsed);
	} else {
		return file.path;
	}
}
