import * as path from "path";
import { TAbstractFile, TFile, Vault } from "obsidian";

export interface ConflictGroup {
    originalPath: string;
    original: TFile | null;
    conflicts: {
        name: ParsedConflictName;
        file: TFile;
    }[];
}

const regexp = /(?<baseName>.*)\.sync-conflict-(?<date>\d{8}-\d{6})-(?<device>.*)/;

function isConflict(file: TFile): boolean {
    return regexp.test(file.basename);
}

function getOriginalFilePath(file: TFile, parsed: ParsedConflictName): string {
    return path.join(file.parent?.path || "", parsed.originalName);
}

export function getAllConflictGroups(vault: Vault): Map<string, ConflictGroup> {
    const conflicts = new Map<string, ConflictGroup>();

    const allFiles = vault.getFiles();
    for (const file of allFiles) {
        if (isConflict(file)) {
            const parsedConflictName = parseConflictName(file);
            const originalFilePath = getOriginalFilePath(file, parsedConflictName);
            const originalFile = vault.getAbstractFileByPath(originalFilePath);

            if (!conflicts.has(originalFilePath)) {
                conflicts.set(originalFilePath, {
                    originalPath: originalFilePath,
                    original: asTFile(originalFile),
                    conflicts: [{
                        name: parsedConflictName,
                        file: file,
                    }]
                });
            } else {
                const conflict = conflicts.get(originalFilePath)!;
                conflict.conflicts.push({
                    name: parsedConflictName,
                    file: file,
                });
            }
        }
    }

    return conflicts;
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
    let originalFilePath: string;
    let originalFile: TFile | null;
    if (isConflict(file)) {
        const parsed = parseConflictName(file);
        originalFilePath = getOriginalFilePath(file, parsed);
        originalFile = asTFile(vault.getAbstractFileByPath(originalFilePath));
    } else {
        originalFilePath = file.path;
        originalFile = file;
    }

    const group: ConflictGroup = {
        originalPath: originalFilePath,
        original: originalFile,
        conflicts: [],
    }

    const parent = file.parent || vault.getRoot();
    for (const aChild of parent.children) {
        const child = asTFile(aChild);
        if (child == null || child.path === originalFilePath || !isConflict(child)) {
            continue
        }

        const parsed = parseConflictName(child);
        const curOriginalFilePath = getOriginalFilePath(child, parsed);
        if (curOriginalFilePath === originalFilePath) {
            group.conflicts.push({
                name: parsed,
                file: child,
            });
        }
    }

    return group;
}

export interface ParsedConflictName {
    originalName: string;
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

    return {
        originalName: (baseName || "") + "." + file.extension ?? "",
        date: date ? new Date(date) : new Date(),
        device: device ?? "",
    }
}