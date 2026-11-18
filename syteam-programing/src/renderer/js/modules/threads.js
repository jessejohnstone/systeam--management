const startThreadButton = document.getElementById('start-thread');
const threadTableBody = document.getElementById('thread-table-body');
const threadProgressBar = document.getElementById('thread-progress-bar');
const threadProgressText = document.getElementById('thread-progress-text');
const threadMessage = document.getElementById('thread-message');
const threadResult = document.getElementById('thread-result');

const threadRows = new Map();

async function requestThreadApi(action, values) {
    const response = await fetch(`/api/threads/${action}`, {
        method: values ? 'POST' : 'GET',
        headers: values ? { 'Content-Type': 'application/json' } : undefined,
        body: values ? JSON.stringify(values) : undefined,
        cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.message || `Request failed (${response.status}).`);
    }
    return result;
}

const isLocalThreadServer =
    location.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(location.hostname);
const threadAPI = window.systemAPI ?? (isLocalThreadServer ? {
    startThread: () => requestThreadApi('start', {}),
    stopThread: threadId => requestThreadApi('stop', { threadId }),
    getThreads: requestThreadApi.bind(null, 'list'),
    onThreadProgress: callback => {
        const lastUpdates = new Map();
        const timer = setInterval(async () => {
            try {
                const result = await requestThreadApi('list');
                result.threads.forEach(thread => {
                    const message = { threadId: thread.threadId, ...thread.latestUpdate };
                    const signature = JSON.stringify([thread.status, message]);
                    if (lastUpdates.get(thread.threadId) !== signature) {
                        lastUpdates.set(thread.threadId, signature);
                        callback(message);
                    }
                });
            } catch (error) {
                showThreadMessage(error.message || 'Unable to refresh thread status.', false);
            }
        }, 500);
        return () => clearInterval(timer);
    }
} : null);

if (!threadAPI?.startThread || !threadAPI?.onThreadProgress) {
    startThreadButton.disabled = true;
    showThreadMessage('Thread management is available in the desktop app or local development server.', false);
}

function showThreadMessage(message, success = true) {
    threadMessage.textContent = message;
    threadMessage.style.color = success ? '#16a34a' : '#dc2626';
}

function createThreadRow(threadId) {
    if (threadTableBody.querySelector('td[colspan]')) {
        threadTableBody.replaceChildren();
    }

    const row = document.createElement('tr');

    const idCell = document.createElement('td');
    idCell.textContent = threadId;

    const statusCell = document.createElement('td');
    statusCell.textContent = 'Running';

    const progressCell = document.createElement('td');
    progressCell.textContent = '0%';

    const actionCell = document.createElement('td');

    const stopButton = document.createElement('button');
    stopButton.textContent = 'Stop';
    stopButton.className = 'stop-btn';

    stopButton.addEventListener('click', async () => {
        try {
            const result = await threadAPI.stopThread(threadId);

            statusCell.textContent = 'Stopped';
            progressCell.textContent = 'Stopped';
            stopButton.disabled = true;
            threadResult.textContent = `Thread ${threadId} stopped before completion.`;

            showThreadMessage(result.message);
        } catch (error) {
            showThreadMessage(error.message, false);
        }
    });

    actionCell.appendChild(stopButton);

    row.append(idCell, statusCell, progressCell, actionCell);
    threadTableBody.appendChild(row);

    threadRows.set(threadId, {
        statusCell,
        progressCell,
        stopButton
    });
}

startThreadButton.addEventListener('click', async () => {
    startThreadButton.disabled = true;

    try {
        showThreadMessage('Starting background thread...');

        const result = await threadAPI.startThread();

        if (!result.success) {
            throw new Error(result.message);
        }

        createThreadRow(result.threadId);

        threadProgressBar.style.width = '0%';
        threadProgressText.textContent = 'Progress: 0%';
        threadResult.textContent = 'Task is running...';

        showThreadMessage(
            `Thread ${result.threadId} started successfully.`
        );

    } catch (error) {
        showThreadMessage(error.message, false);
    } finally {
        startThreadButton.disabled = false;
    }
});

function handleThreadUpdate(message) {
    const thread = threadRows.get(message.threadId);

    if (!thread) return;

    if (message.type === 'progress') {
        thread.progressCell.textContent = `${message.progress}%`;

        threadProgressBar.style.width = `${message.progress}%`;
        threadProgressText.textContent =
            `Progress: ${message.progress}%`;

        showThreadMessage(
            `Thread ${message.threadId} is processing ${message.current.toLocaleString()} of ${message.maximum.toLocaleString()} numbers.`
        );
    }

    if (message.type === 'completed') {
        thread.statusCell.textContent = 'Completed';
        thread.progressCell.textContent = '100%';
        thread.stopButton.disabled = true;

        threadProgressBar.style.width = '100%';
        threadProgressText.textContent = 'Progress: 100%';

        threadResult.textContent =
            `Total prime numbers found: ${message.result.toLocaleString()}`;

        showThreadMessage(
            `Thread ${message.threadId} completed successfully.`
        );
    }

    if (message.type === 'error') {
        thread.statusCell.textContent = 'Error';
        thread.stopButton.disabled = true;

        showThreadMessage(message.message, false);
    }

    if (message.type === 'stopped') {
        thread.statusCell.textContent = 'Stopped';
        thread.progressCell.textContent = 'Stopped';
        thread.stopButton.disabled = true;
        threadResult.textContent = `Thread ${message.threadId} stopped before completion.`;
        showThreadMessage(message.message || `Thread ${message.threadId} stopped.`);
    }
}

// Listen for updates from background workers or browser polling.
threadAPI?.onThreadProgress(handleThreadUpdate);

async function restoreExistingThreads() {
    if (!threadAPI?.getThreads) return;

    try {
        const response = await threadAPI.getThreads();
        const threads = Array.isArray(response) ? response : response.threads;

        for (const thread of threads || []) {
            if (threadRows.has(thread.threadId)) continue;

            createThreadRow(thread.threadId);
            const row = threadRows.get(thread.threadId);
            row.statusCell.textContent = thread.status;
            row.stopButton.disabled = thread.status !== 'Running';

            if (thread.latestUpdate) {
                handleThreadUpdate({
                    threadId: thread.threadId,
                    ...thread.latestUpdate
                });
            }
        }
    } catch (error) {
        showThreadMessage(error.message || 'Unable to restore thread status.', false);
    }
}

restoreExistingThreads();