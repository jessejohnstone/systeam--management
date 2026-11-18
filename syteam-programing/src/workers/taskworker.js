import { parentPort, workerData } from 'node:worker_threads';

// This worker calculates prime numbers in the background.
function isPrime(number) {
    if (number < 2) return false;

    for (let i = 2; i <= Math.sqrt(number); i++) {
        if (number % i === 0) return false;
    }

    return true;
}

function runTask() {
    const maxNumber = workerData.maxNumber || 500000;
    let primeCount = 0;

    for (let number = 2; number <= maxNumber; number++) {
        if (isPrime(number)) {
            primeCount++;
        }

        // Report progress regularly without flooding IPC with tiny messages.
        if (number % 50000 === 0) {
            parentPort.postMessage({
                type: 'progress',
                progress: Math.round((number / maxNumber) * 100),
                current: number,
                maximum: maxNumber
            });
        }
    }

    parentPort.postMessage({
        type: 'completed',
        result: primeCount,
        maximum: maxNumber
    });
}

try {
    runTask();
} catch (error) {
    parentPort.postMessage({
        type: 'error',
        message: error.message
    });
}