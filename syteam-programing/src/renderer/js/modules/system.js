const refreshSystemButton =
    document.getElementById('refresh-system');

const systemMessage =
    document.getElementById('system-message');

const systemLastUpdated =
    document.getElementById('system-last-updated');

// Convert bytes into readable memory units.
function formatSystemMemory(bytes) {
    return `${(bytes / (1024 ** 3)).toFixed(2)} GB`;
}

// Convert seconds into days, hours and minutes.
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days} days, ${hours} hours, ${minutes} minutes`;
}

// Display information safely.
function setSystemValue(elementId, value) {
    document.getElementById(elementId).textContent =
        value === null || value === undefined || value === ''
            ? 'Not available'
            : value;
}

async function getSystemInformation() {
    if (window.systemAPI?.getSystemInfo) {
        return window.systemAPI.getSystemInfo();
    }

    if (
        location.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(location.hostname)
    ) {
        const response = await fetch('/api/system/info', {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || `Request failed (${response.status}).`);
        }
        return result;
    }

    throw new Error('System information is available from the desktop app or local development server.');
}

// Retrieve computer information.
async function loadSystemInformation() {
    refreshSystemButton.disabled = true;

    try {
        systemMessage.textContent =
            'Retrieving computer information...';

        const response = await getSystemInformation();

        if (!response.success) {
            throw new Error(response.message);
        }

        const { computer, operatingSystem, processor, memory, uptime, user } =
            response.system;

        // Computer information
        setSystemValue('system-hostname', computer.hostname);
        setSystemValue('system-manufacturer', computer.manufacturer);
        setSystemValue('system-model', computer.model);

        // Operating system
        setSystemValue(
            'system-os',
            operatingSystem.distro
        );

        setSystemValue(
            'system-release',
            operatingSystem.release
        );

        setSystemValue(
            'system-kernel',
            operatingSystem.kernel
        );

        setSystemValue(
            'system-architecture',
            operatingSystem.architecture
        );

        // Processor
        setSystemValue('cpu-brand', processor.brand);
        setSystemValue('cpu-manufacturer', processor.manufacturer);

        setSystemValue(
            'cpu-physical-cores',
            processor.physicalCores
        );

        setSystemValue(
            'cpu-logical-cores',
            processor.logicalCores
        );

        setSystemValue(
            'cpu-speed',
            `${processor.speed} GHz`
        );

        // Additional information
        setSystemValue(
            'system-total-ram',
            formatSystemMemory(memory.total)
        );

        setSystemValue(
            'system-uptime',
            formatUptime(uptime)
        );

        setSystemValue('system-user', user);

        systemMessage.textContent =
            'System information retrieved successfully.';

        systemLastUpdated.textContent =
            `Last updated: ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        systemMessage.textContent =
            `Error: ${error.message}`;

        console.error(error);

    } finally {
        refreshSystemButton.disabled = false;
    }
}

// Refresh information when requested.
refreshSystemButton.addEventListener(
    'click',
    loadSystemInformation
);

// Load information when the module script starts.
loadSystemInformation();