
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_PREVIEW_BYTES = 1024 * 1024;
const INVALID_WINDOWS_NAME = /[<>:"|?*]/;
const RESERVED_WINDOWS_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

let selectedDirectory = null;

function validateName(name) {
    if (typeof name !== 'string' || !name.trim()) {
        throw new Error('Enter a valid file or folder name.');
    }

    if (
        name === '.' ||
        name === '..' ||
        name.includes('/') ||
        name.includes('\\') ||
        Array.from(name).some(character => {
            const code = character.charCodeAt(0);
            return code < 32 || code === 127;
        }) ||
        INVALID_WINDOWS_NAME.test(name) ||
        /[. ]$/.test(name) ||
        RESERVED_WINDOWS_NAME.test(name)
    ) {
        throw new Error('Use a name only (no path separators, reserved names, or invalid Windows characters).');
    }

    return name;
}

function requireDirectory() {
    if (!selectedDirectory) {
        throw new Error('Choose a working folder first.');
    }
    return selectedDirectory;
}

function getSafePath(name) {
    const directory = requireDirectory();
    const safeName = validateName(name);
    const fullPath = path.resolve(directory, safeName);

    if (path.dirname(fullPath) !== directory) {
        throw new Error('Access outside the selected folder is not allowed.');
    }

    return fullPath;
}

async function setDirectory(directoryPath) {
    if (typeof directoryPath !== 'string' || !directoryPath.trim()) {
        throw new Error('The selected folder path is invalid.');
    }

    const realPath = await fs.realpath(directoryPath);
    const stats = await fs.stat(realPath);

    if (!stats.isDirectory()) {
        throw new Error('Choose a folder, not a file.');
    }

    selectedDirectory = realPath;
    return selectedDirectory;
}

function getDirectory() {
    return selectedDirectory;
}

async function listFiles() {
    const directory = requireDirectory();
    const entries = await fs.readdir(directory, { withFileTypes: true });

    const files = await Promise.all(entries.map(async entry => {
        const stats = await fs.lstat(path.join(directory, entry.name));
        let type = 'Other';

        if (entry.isSymbolicLink()) {
            type = 'Link';
        } else if (stats.isDirectory()) {
            type = 'Folder';
        } else if (stats.isFile()) {
            type = 'File';
        }

        return {
            name: entry.name,
            type,
            size: stats.size,
            modified: stats.mtime.toISOString()
        };
    }));

    return files.sort((a, b) => {
        if (a.type === 'Folder' && b.type !== 'Folder') return -1;
        if (a.type !== 'Folder' && b.type === 'Folder') return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}

async function createFolder(folderName) {
    await fs.mkdir(getSafePath(folderName));
    return { success: true, message: `Folder “${folderName}” created.` };
}

async function createFile(fileName) {
    const filePath = getSafePath(fileName);
    const handle = await fs.open(filePath, 'wx');
    await handle.close();
    return { success: true, message: `Text file “${fileName}” created.` };
}

async function readFile(fileName) {
    const filePath = getSafePath(fileName);
    const stats = await fs.lstat(filePath);

    if (!stats.isFile()) {
        throw new Error('Only regular files can be previewed.');
    }

    if (stats.size > MAX_PREVIEW_BYTES) {
        throw new Error('This file is too large to preview (maximum 1 MB).');
    }

    const handle = await fs.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(MAX_PREVIEW_BYTES + 1);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);

        if (bytesRead > MAX_PREVIEW_BYTES) {
            throw new Error('This file is too large to preview (maximum 1 MB).');
        }

        const content = buffer.subarray(0, bytesRead);
        if (content.includes(0)) {
            throw new Error('This file appears to be binary and cannot be previewed as text.');
        }

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(content);
        } catch {
            throw new Error('This file is not valid UTF-8 text and cannot be previewed.');
        }
    } finally {
        await handle.close();
    }
}

async function deleteFile(fileName) {
    const filePath = getSafePath(fileName);
    const stats = await fs.lstat(filePath);

    if (!stats.isFile()) {
        throw new Error('Only regular files can be deleted. Folders and links are protected.');
    }

    await fs.unlink(filePath);
    return { success: true, message: `File “${fileName}” deleted.` };
}

export {
    setDirectory,
    getDirectory,
    listFiles,
    createFolder,
    createFile,
    readFile,
    deleteFile
};
