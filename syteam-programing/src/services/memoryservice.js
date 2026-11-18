import os from 'node:os';

function getMemoryInfo() {
    // Total physical RAM installed
    const totalMemory = os.totalmem();

    // Currently available physical RAM
    const freeMemory = os.freemem();

    // Calculate used physical RAM
    const usedMemory = totalMemory - freeMemory;

    // Calculate RAM usage percentage
    const usagePercentage = (usedMemory / totalMemory) * 100;

    // Get memory used by the Electron main process
    const appMemory = process.memoryUsage();

    return {
        system: {
            total: totalMemory,
            used: usedMemory,
            free: freeMemory,
            percentage: Number(usagePercentage.toFixed(2))
        },

        application: {
            rss: appMemory.rss,
            heapUsed: appMemory.heapUsed,
            heapTotal: appMemory.heapTotal,
            external: appMemory.external
        }
    };
}

export {
    getMemoryInfo
};