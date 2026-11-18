
const selectDirectoryButton = document.getElementById('select-directory');
const refreshFilesButton = document.getElementById('refresh-files');
const createFolderButton = document.getElementById('create-folder');
const createFileButton = document.getElementById('create-file');

const selectedDirectory = document.getElementById('selected-directory');
const fileTableBody = document.getElementById('file-table-body');
const filePreview = document.getElementById('file-preview');
const fileMessage = document.getElementById('file-message');

let activeDirectory = null;
let browserDirectoryHandle = null;

function validateBrowserName(name) {
    if (
        typeof name !== 'string' ||
        !name.trim() ||
        name === '.' ||
        name === '..' ||
        /[\\/<>:"|?*]/.test(name) ||
        Array.from(name).some(character => character.charCodeAt(0) < 32) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name) ||
        /[. ]$/.test(name)
    ) {
        throw new Error('Enter a single valid name without a path.');
    }
}

async function listBrowserFiles() {
    if (!browserDirectoryHandle) {
        throw new Error('Choose a folder first.');
    }

    const files = [];
    for await (const [name, handle] of browserDirectoryHandle.entries()) {
        if (handle.kind === 'directory') {
            files.push({ name, type: 'Folder', size: 0, modified: null });
            continue;
        }

        const file = await handle.getFile();
        files.push({
            name,
            type: 'File',
            size: file.size,
            modified: new Date(file.lastModified).toISOString()
        });
    }

    return files.sort((a, b) => {
        if (a.type === 'Folder' && b.type !== 'Folder') return -1;
        if (a.type !== 'Folder' && b.type === 'Folder') return 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}

async function ensureBrowserNameIsNew(name) {
    validateBrowserName(name);
    for await (const [entryName] of browserDirectoryHandle.entries()) {
        if (entryName.toLocaleLowerCase() === name.toLocaleLowerCase()) {
            throw new Error(`“${name}” already exists.`);
        }
    }
}

function createBrowserFileAPI() {
    return {
        async selectDirectory() {
            if (!window.showDirectoryPicker) {
                throw new Error('This browser does not support folder access. Open the app with npm start after installing Electron.');
            }

            browserDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            return {
                success: true,
                directory: browserDirectoryHandle.name,
                pathHidden: true,
                files: await listBrowserFiles()
            };
        },
        async getSelectedDirectory() {
            return {
                success: true,
                directory: browserDirectoryHandle?.name ?? null,
                pathHidden: Boolean(browserDirectoryHandle)
            };
        },
        async listFiles() {
            return { success: true, files: await listBrowserFiles() };
        },
        async createFolder(name) {
            await ensureBrowserNameIsNew(name);
            await browserDirectoryHandle.getDirectoryHandle(name, { create: true });
            return { success: true, message: `Folder “${name}” created.` };
        },
        async createFile(name) {
            await ensureBrowserNameIsNew(name);
            const handle = await browserDirectoryHandle.getFileHandle(name, { create: true });
            const writable = await handle.createWritable();
            await writable.close();
            return { success: true, message: `Text file “${name}” created.` };
        },
        async readFile(name) {
            validateBrowserName(name);
            const file = await (await browserDirectoryHandle.getFileHandle(name)).getFile();
            if (file.size > 1024 * 1024) {
                throw new Error('This file is too large to preview (maximum 1 MB).');
            }

            const bytes = new Uint8Array(await file.arrayBuffer());
            if (bytes.includes(0)) {
                throw new Error('This file appears to be binary and cannot be previewed as text.');
            }

            try {
                return {
                    success: true,
                    content: new TextDecoder('utf-8', { fatal: true }).decode(bytes)
                };
            } catch {
                throw new Error('This file is not valid UTF-8 text and cannot be previewed.');
            }
        },
        async deleteFile(name) {
            validateBrowserName(name);
            await browserDirectoryHandle.getFileHandle(name);
            await browserDirectoryHandle.removeEntry(name);
            return { success: true, message: `File “${name}” deleted.` };
        }
    };
}

const fileAPI = window.systemAPI ?? createBrowserFileAPI();

function setDirectoryControlsEnabled(enabled) {
    refreshFilesButton.disabled = !enabled;
    createFolderButton.disabled = !enabled;
    createFileButton.disabled = !enabled;
}

setDirectoryControlsEnabled(false);

function showFileMessage(message, success = true) {
    fileMessage.textContent = message;
    fileMessage.style.color = success ? '#16a34a' : '#dc2626';
}

function formatSize(bytes, type) {
    if (type === 'Folder') return '—';
    return `${Number(bytes).toLocaleString()} bytes`;
}

function formatModified(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function showEmptyTable(message) {
    fileTableBody.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = message;
    row.appendChild(cell);
    fileTableBody.appendChild(row);
}

async function loadFiles() {
    if (!activeDirectory) {
        showEmptyTable('Choose a folder to begin.');
        return;
    }

    showEmptyTable('Loading files...');

    try {
        const result = await fileAPI.listFiles();

        if (!result.success) {
            throw new Error(result.message);
        }

        displayFiles(result.files);
        return true;
    } catch (error) {
        showEmptyTable('Unable to load files.');
        showFileMessage(error.message || 'Unable to load this folder.', false);
        return false;
    }
}

function displayFiles(files) {
    fileTableBody.replaceChildren();

    if (files.length === 0) {
        showEmptyTable('This folder is empty.');
        return;
    }

    files.forEach(file => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        nameCell.textContent = file.name;

        const typeCell = document.createElement('td');
        typeCell.textContent = file.type;

        const sizeCell = document.createElement('td');
        sizeCell.textContent = formatSize(file.size, file.type);

        const modifiedCell = document.createElement('td');
        modifiedCell.textContent = formatModified(file.modified);

        const actionCell = document.createElement('td');

        if (file.type === 'File') {
            const readButton = document.createElement('button');
            readButton.textContent = 'Read';
            readButton.className = 'action-btn';

            readButton.addEventListener('click', () => {
                readSelectedFile(file.name);
            });

            actionCell.appendChild(readButton);

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.className = 'stop-btn';
            deleteButton.style.marginLeft = '8px';

            deleteButton.addEventListener('click', () => {
                deleteSelectedFile(file.name);
            });

            actionCell.appendChild(deleteButton);
        } else if (file.type === 'Folder') {
            actionCell.textContent = 'Folder';
        } else {
            actionCell.textContent = 'No actions';
        }

        row.append(
            nameCell,
            typeCell,
            sizeCell,
            modifiedCell,
            actionCell
        );

        fileTableBody.appendChild(row);
    });
}

// Select a directory
selectDirectoryButton.addEventListener('click', async () => {
    selectDirectoryButton.disabled = true;
    showFileMessage('Opening folder picker...');

    try {
        const result = await fileAPI.selectDirectory();

        if (!result.success) {
            if (!result.cancelled) {
                showFileMessage(result.message || 'Unable to select that folder.', false);
            }
            return;
        }

        activeDirectory = result.directory;
        selectedDirectory.textContent = result.pathHidden
            ? `${result.directory} (full path hidden by browser)`
            : result.directory;
        selectedDirectory.title = result.directory;
        setDirectoryControlsEnabled(true);
        displayFiles(result.files);
        filePreview.value = '';

        showFileMessage('Folder selected. Its contents are ready.');
    } catch (error) {
        showFileMessage(error.message || 'Unable to select a folder.', false);
    } finally {
        selectDirectoryButton.disabled = false;
    }
});

// Refresh directory contents
refreshFilesButton.addEventListener('click', loadFiles);

// Create a folder
createFolderButton.addEventListener('click', async () => {
    const folderName = prompt('Enter a name for the new folder:');

    if (folderName === null) return;
    if (!folderName.trim()) {
        showFileMessage('Enter a folder name.', false);
        return;
    }

    try {
        const result = await fileAPI.createFolder(folderName);

        if (!result.success) {
            throw new Error(result.message);
        }

        showFileMessage(result.message);
        await loadFiles();
    } catch (error) {
        showFileMessage(error.message, false);
    }
});

// Create a text file
createFileButton.addEventListener('click', async () => {
    const fileName = prompt('Enter a text file name, e.g. notes.txt:');

    if (fileName === null) return;
    if (!fileName.trim()) {
        showFileMessage('Enter a file name.', false);
        return;
    }

    try {
        const result = await fileAPI.createFile(fileName);

        if (!result.success) {
            throw new Error(result.message);
        }

        showFileMessage(result.message);
        await loadFiles();
    } catch (error) {
        showFileMessage(error.message, false);
    }
});

// Read a selected file
async function readSelectedFile(fileName) {
    try {
        const result = await fileAPI.readFile(fileName);

        if (!result.success) {
            throw new Error(result.message);
        }

        filePreview.value = result.content;
        showFileMessage(`${fileName} opened successfully.`);
    } catch (error) {
        showFileMessage(error.message || `Unable to preview ${fileName}.`, false);
    }
}

// Delete a selected file
async function deleteSelectedFile(fileName) {
    const confirmed = confirm(
        `Are you sure you want to delete ${fileName}?`
    );

    if (!confirmed) return;

    try {
        const result = await fileAPI.deleteFile(fileName);

        if (!result.success) {
            throw new Error(result.message);
        }

        filePreview.value = '';
        showFileMessage(result.message);
        await loadFiles();
    } catch (error) {
        showFileMessage(error.message || `Unable to delete ${fileName}.`, false);
    }
}

async function restoreSelectedDirectory() {
    try {
        const result = await fileAPI.getSelectedDirectory();

        if (!result.success || !result.directory) {
            showEmptyTable('Choose a folder to begin.');
            return;
        }

        activeDirectory = result.directory;
        selectedDirectory.textContent = result.pathHidden
            ? `${result.directory} (full path hidden by browser)`
            : result.directory;
        selectedDirectory.title = result.directory;
        setDirectoryControlsEnabled(true);
        await loadFiles();
    } catch (error) {
        showEmptyTable('Choose a folder to begin.');
        showFileMessage(error.message || 'File Management is unavailable.', false);
    }
}

restoreSelectedDirectory();
