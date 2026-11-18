
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fileService from './src/services/fileservice.js';
import { getSystemInfo } from './src/services/systemservice.js';
import { getMemoryInfo } from './src/services/memoryservice.js';
import { getActiveThreads, startThread, stopThread } from './src/services/threadService.js';
import {
    getManagedProcesses,
    listProcesses,
    startProcess,
    stopProcess
} from './src/services/processsservice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1300,
        height: 850,
        minWidth: 1000,
        minHeight: 650,
        title: 'System Programming Management System',

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    mainWindow.loadFile(
        path.join(__dirname, 'src', 'renderer', 'index.html')
    );
}

// Application information
ipcMain.handle('app:get-info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform
}));

ipcMain.handle('process:start', (_event, application) => {
    try {
        return startProcess(application);
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('process:list', async () => {
    try {
        return { success: true, processes: await listProcesses() };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('process:stop', (_event, pid) => {
    try {
        return stopProcess(pid);
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('process:managed', () => ({
    success: true,
    processes: getManagedProcesses()
}));

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// ===============================
// FILE MANAGEMENT IPC
// ===============================

ipcMain.handle('files:select-directory', async (event) => {
    try {
        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        const result = await dialog.showOpenDialog(parentWindow, {
            title: 'Select a working folder',
            properties: ['openDirectory']
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, cancelled: true, message: 'Folder selection cancelled.' };
        }

        const directory = await fileService.setDirectory(result.filePaths[0]);

        const files = await fileService.listFiles();

        return {
            success: true,
            directory,
            files
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('files:list', async () => {
    try {
        return {
            success: true,
            files: await fileService.listFiles()
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('files:create-folder', async (event, name) => {
    try {
        return await fileService.createFolder(name);
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('files:create-file', async (event, name) => {
    try {
        return await fileService.createFile(name);
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('files:read', async (event, name) => {
    try {
        return {
            success: true,
            content: await fileService.readFile(name)
        };
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('files:delete', async (event, name) => {
    try {
        return await fileService.deleteFile(name);
    } catch (error) {
        return { success: false, message: error.message };
    }
});

ipcMain.handle('files:get-directory', () => ({
    success: true,
    directory: fileService.getDirectory()
}));
// Start a background thread
ipcMain.handle('thread:start', (event) => {
    try {
        return startThread((message) => {
            if (!event.sender.isDestroyed()) {
                event.sender.send('thread:progress', message);
            }
        });
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
});

// Stop a background thread
ipcMain.handle('thread:stop', async (event, threadId) => {
    try {
        return await stopThread(threadId);
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
});

// Get active threads
ipcMain.handle('thread:list', () => {
    return getActiveThreads();
});
// Memory Management
ipcMain.handle('memory:get-info', () => {
    try {
        return {
            success: true,
            memory: getMemoryInfo()
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
});

// System Information
ipcMain.handle('system:get-info', async () => {
    try {
        return {
            success: true,
            system: await getSystemInfo()
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
});