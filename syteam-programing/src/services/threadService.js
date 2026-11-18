import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(new URL('../workers/taskworker.js', import.meta.url));
const MAX_NUMBER = 5000000;

const activeWorkers = new Map();

function startThread(onUpdate) {
    const worker = new Worker(workerPath, {
        workerData: {
            maxNumber: MAX_NUMBER
        }
    });

    const threadId = worker.threadId;

    activeWorkers.set(threadId, {
        worker,
        status: 'Running',
        latestUpdate: {
            type: 'progress',
            progress: 0,
            current: 0,
            maximum: MAX_NUMBER
        }
    });

    worker.on('message', (message) => {
        if (message.type === 'completed') {
            const thread = activeWorkers.get(threadId);
            if (thread) thread.status = 'Completed';
        }

        const thread = activeWorkers.get(threadId);
        if (thread) thread.latestUpdate = message;

        onUpdate({
            threadId,
            ...message
        });
    });

    worker.on('error', (error) => {
        const thread = activeWorkers.get(threadId);
        if (thread) {
            thread.status = 'Error';
            thread.latestUpdate = { type: 'error', message: error.message };
            thread.worker = null;
        }

        onUpdate({
            threadId,
            type: 'error',
            message: error.message
        });
    });

    worker.on('exit', (code) => {
        const thread = activeWorkers.get(threadId);
        if (thread) {
            if (code !== 0 && thread.status === 'Running') {
                thread.status = 'Error';
                thread.latestUpdate = {
                    type: 'error',
                    message: `Worker stopped with exit code ${code}.`
                };
                onUpdate({ threadId, ...thread.latestUpdate });
            }
            thread.worker = null;
        }
    });

    return {
        success: true,
        threadId,
        status: 'Running'
    };
}

async function stopThread(threadId) {
    const thread = activeWorkers.get(Number(threadId));

    if (!thread || thread.status !== 'Running' || !thread.worker) {
        throw new Error('Thread not found or already finished.');
    }

    await thread.worker.terminate();
    thread.status = 'Stopped';
    thread.worker = null;
    thread.latestUpdate = { type: 'stopped', message: `Thread ${threadId} stopped.` };

    return {
        success: true,
        message: `Thread ${threadId} stopped successfully.`
    };
}

function getActiveThreads() {
    return Array.from(activeWorkers.entries()).map(([threadId, thread]) => ({
        threadId,
        status: thread.status,
        latestUpdate: thread.latestUpdate
    }));
}

export {
    startThread,
    stopThread,
    getActiveThreads
};