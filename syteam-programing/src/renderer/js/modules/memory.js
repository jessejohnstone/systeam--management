const refreshMemoryButton =
    document.getElementById('refresh-memory');

const totalMemoryElement =
    document.getElementById('total-memory');

const usedMemoryElement =
    document.getElementById('used-memory');

const freeMemoryElement =
    document.getElementById('free-memory');

const memoryProgressBar =
    document.getElementById('memory-progress-bar');

const memoryPercentage =
    document.getElementById('memory-percentage');

const appRss =
    document.getElementById('app-rss');

const appHeapUsed =
    document.getElementById('app-heap-used');

const appHeapTotal =
    document.getElementById('app-heap-total');

const appExternal =
    document.getElementById('app-external');

const memoryMessage =
    document.getElementById('memory-message');

const lastUpdated =
    document.getElementById('memory-last-updated');

let memoryRequestInProgress = false;

async function getMemoryInformation() {
    if (window.systemAPI?.getMemoryInfo) {
        return window.systemAPI.getMemoryInfo();
    }

    if (
        location.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(location.hostname)
    ) {
        const response = await fetch('/api/memory/info', {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `Request failed (${response.status}).`);
        }
        return result;
    }

    throw new Error('Memory information is available from the desktop app or local development server.');
}

// Convert bytes into readable units.
function formatMemory(bytes) {
    const gigabytes = bytes / (1024 ** 3);

    if (gigabytes >= 1) {
        return `${gigabytes.toFixed(2)} GB`;
    }

    const megabytes = bytes / (1024 ** 2);
    return `${megabytes.toFixed(2)} MB`;
}

// Retrieve and display memory information.
async function loadMemoryInfo() {
    if (memoryRequestInProgress) return;
    memoryRequestInProgress = true;
    refreshMemoryButton.disabled = true;

    try {
        memoryMessage.textContent = 'Retrieving memory information...';

        const response = await getMemoryInformation();

        if (!response.success) {
            throw new Error(response.message);
        }

        const { system, application } = response.memory;

        // System RAM
        totalMemoryElement.textContent =
            formatMemory(system.total);

        usedMemoryElement.textContent =
            formatMemory(system.used);

        freeMemoryElement.textContent =
            formatMemory(system.free);

        memoryProgressBar.style.width =
            `${system.percentage}%`;

        memoryPercentage.textContent =
            `Usage: ${system.percentage}%`;

        // Electron main process memory
        appRss.textContent =
            formatMemory(application.rss);

        appHeapUsed.textContent =
            formatMemory(application.heapUsed);

        appHeapTotal.textContent =
            formatMemory(application.heapTotal);

        appExternal.textContent =
            formatMemory(application.external);

        memoryMessage.textContent =
            'Memory information retrieved successfully.';

        lastUpdated.textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        memoryMessage.textContent =
            `Error: ${error.message}`;

        console.error(error);

    } finally {
        memoryRequestInProgress = false;
        refreshMemoryButton.disabled = false;
    }
}

// Refresh when the user clicks the button.
refreshMemoryButton.addEventListener(
    'click',
    loadMemoryInfo
);

// Automatically update every 3 seconds.
loadMemoryInfo();
setInterval(loadMemoryInfo, 3000);