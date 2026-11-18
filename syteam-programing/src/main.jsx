
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Create the main application window
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,

        title: 'System Programming Management System',

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    // Load our HTML interface
    mainWindow.loadFile(
        path.join(__dirname, 'src', 'renderer', 'index.html')
    );
}

// Handle application information requests
ipcMain.handle('app:get-info', () => {
    return {
        name: app.getName(),
        version: app.getVersion(),
        platform: process.platform
    };
});

// Start the application
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Close application on Windows/Linux when all windows close
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

ipcMain.handle('process:start', async (event, application) => {
    try {
        return processService.startProcess(application);
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
});

ipcMain.handle('process:list', async () => {
    try {
        return {
            success: true,
            processes: await processService.listProcesses()
        };
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
});

ipcMain.handle('process:stop', async (event, pid) => {
    try {
        return processService.stopProcess(pid);
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
});

ipcMain.handle('process:managed', () => {
    return processService.getManagedProcesses();
});
