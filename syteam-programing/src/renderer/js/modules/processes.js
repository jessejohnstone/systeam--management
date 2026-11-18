
const applicationSelect = document.getElementById(
    'application-select'
);

const startButton = document.getElementById(
    'start-process'
);

const refreshButton = document.getElementById(
    'refresh-processes'
);

const processTableBody = document.getElementById(
    'process-table-body'
);

const processMessage = document.getElementById(
    'process-message'
);

async function requestProcessApi(action, values) {
    const response = await fetch(`/api/processes/${action}`, {
        method: values ? 'POST' : 'GET',
        headers: values ? { 'Content-Type': 'application/json' } : undefined,
        body: values ? JSON.stringify(values) : undefined
    });
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || `Request failed (${response.status}).`);
    }

    return result;
}

const isLocalDevelopmentServer =
    location.protocol === 'http:' &&
    ['127.0.0.1', 'localhost'].includes(location.hostname);

const processAPI = window.systemAPI ?? (isLocalDevelopmentServer ? {
    startProcess: application => requestProcessApi('start', { application }),
    listProcesses: () => requestProcessApi('list'),
    stopProcess: pid => requestProcessApi('stop', { pid })
} : null);

if (!processAPI?.listProcesses) {
    startButton.disabled = true;
    refreshButton.disabled = true;
}


// Display messages
function showProcessMessage(message, success = true) {

    processMessage.textContent = message;

    processMessage.style.color = success
        ? '#16a34a'
        : '#dc2626';
}


// START PROCESS
startButton.addEventListener('click', async () => {

    if (!processAPI?.startProcess) {
        showProcessMessage(
            'Open the app with npm run dev or npm start to manage processes.',
            false
        );
        return;
    }

    const application = applicationSelect.value;

    startButton.disabled = true;

    showProcessMessage('Starting application...');

    try {

        const result = await processAPI.startProcess(
            application
        );

        if (result.success) {

            showProcessMessage(
                `${result.name} started successfully. PID: ${result.pid}`
            );

            await loadProcesses();

        } else {

            showProcessMessage(result.message, false);

        }

    } catch (error) {

        showProcessMessage(error.message, false);

    } finally {

        startButton.disabled = false;

    }

});


// LOAD PROCESSES
async function loadProcesses() {

    if (!processAPI?.listProcesses) {
        processTableBody.innerHTML = `
            <tr>
                <td colspan="4">Open the app with npm run dev or npm start to view processes.</td>
            </tr>
        `;
        showProcessMessage(
            'Open the app with npm run dev or npm start to view processes.',
            false
        );
        return;
    }

    processTableBody.innerHTML = `
        <tr>
            <td colspan="4">Loading processes...</td>
        </tr>
    `;

    try {

        const result = await processAPI.listProcesses();

        if (!result.success) {
            throw new Error(result.message);
        }

        processTableBody.innerHTML = '';

        result.processes.forEach(process => {

            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = process.name;

            const pidCell = document.createElement('td');
            pidCell.textContent = process.pid;

            const memoryCell = document.createElement('td');
            memoryCell.textContent = process.memory;

            const actionCell = document.createElement('td');

            const stopButton = document.createElement('button');

            stopButton.textContent = 'Stop';
            stopButton.className = 'stop-btn';

            stopButton.addEventListener('click', async () => {

                await stopSelectedProcess(process.pid);

            });

            actionCell.appendChild(stopButton);

            row.append(
                nameCell,
                pidCell,
                memoryCell,
                actionCell
            );

            processTableBody.appendChild(row);

        });

        if (result.processes.length === 0) {

            processTableBody.innerHTML = `
                <tr>
                    <td colspan="4">No processes found.</td>
                </tr>
            `;

        }

    } catch (error) {

        processTableBody.innerHTML = `
            <tr>
                <td colspan="4">Unable to load processes.</td>
            </tr>
        `;

        showProcessMessage(error.message, false);

    }

}


// STOP PROCESS
async function stopSelectedProcess(pid) {

    const confirmed = confirm(
        `Are you sure you want to stop process ${pid}?`
    );

    if (!confirmed) return;

    try {

        const result = await processAPI.stopProcess(pid);

        showProcessMessage(
            result.message,
            result.success
        );

        await loadProcesses();

    } catch (error) {

        showProcessMessage(error.message, false);

    }

}


// REFRESH PROCESSES
refreshButton.addEventListener('click', loadProcesses);


// Initial loading
loadProcesses();
