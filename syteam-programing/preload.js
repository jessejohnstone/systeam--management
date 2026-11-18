const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('systemAPI', {
    getAppInfo: () => ipcRenderer.invoke('app:get-info'),

    startProcess: application =>
        ipcRenderer.invoke('process:start', application),
    listProcesses: () =>
        ipcRenderer.invoke('process:list'),
    stopProcess: pid =>
        ipcRenderer.invoke('process:stop', pid),
    getManagedProcesses: () =>
        ipcRenderer.invoke('process:managed'),

    selectDirectory: () =>
        ipcRenderer.invoke('files:select-directory'),
    getSelectedDirectory: () =>
        ipcRenderer.invoke('files:get-directory'),
    listFiles: () =>
        ipcRenderer.invoke('files:list'),
    createFolder: name =>
        ipcRenderer.invoke('files:create-folder', name),
    createFile: name =>
        ipcRenderer.invoke('files:create-file', name),
    readFile: name =>
        ipcRenderer.invoke('files:read', name),
    deleteFile: name =>
        ipcRenderer.invoke('files:delete', name),

    startThread: () =>
        ipcRenderer.invoke('thread:start'),
    stopThread: threadId =>
        ipcRenderer.invoke('thread:stop', threadId),
    getThreads: () =>
        ipcRenderer.invoke('thread:list'),
    onThreadProgress: callback => {
        const listener = (_event, message) => callback(message);
        ipcRenderer.on('thread:progress', listener);
        return () => ipcRenderer.removeListener('thread:progress', listener);
    },

    getMemoryInfo: () =>
        ipcRenderer.invoke('memory:get-info'),
    getSystemInfo: () =>
        ipcRenderer.invoke('system:get-info')
});
