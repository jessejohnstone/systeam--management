
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Keep track of processes launched by our application
const managedProcesses = new Map();

// Applications users are allowed to launch
const allowedApplications = {
    notepad: {
        executable: 'notepad.exe',
        name: 'Notepad'
    },

    calculator: {
        executable: 'calc.exe',
        name: 'Calculator'
    }
};

// START PROCESS
function startProcess(application) {

    const selectedApp = allowedApplications[application];

    if (!selectedApp) {
        throw new Error('Application is not supported.');
    }

    const child = spawn(selectedApp.executable, [], {
        shell: false,
        windowsHide: false
    });

    managedProcesses.set(child.pid, {
        pid: child.pid,
        name: selectedApp.name,
        child,
        status: 'Running'
    });

    child.on('error', () => {
        managedProcesses.delete(child.pid);
    });

    child.on('exit', () => {
        managedProcesses.delete(child.pid);
    });

    return {
        success: true,
        pid: child.pid,
        name: selectedApp.name,
        status: 'Running'
    };
}

// LIST RUNNING PROCESSES
async function listProcesses() {

    const { stdout } = await execFileAsync(
        'tasklist.exe',
        ['/FO', 'CSV', '/NH'],
        { windowsHide: true }
    );

    const processes = stdout
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => {
            const values = line.match(/"([^"]*)"/g);

            if (!values || values.length < 5) {
                return null;
            }

            const fields = values.map(value =>
                value.slice(1, -1)
            );

            return {
                name: fields[0],
                pid: Number(fields[1]),
                session: fields[2],
                memory: fields[4]
            };
        })
        .filter(Boolean);

    return processes;
}

// STOP A PROCESS
function stopProcess(pid) {

    const processId = Number(pid);

    if (!Number.isInteger(processId)) {
        throw new Error('Invalid process ID.');
    }

    const managed = managedProcesses.get(processId);

    if (!managed) {
        throw new Error(
            'You can only stop processes launched by this application.'
        );
    }

    managed.child.kill();

    return {
        success: true,
        message: `${managed.name} termination requested.`
    };
}

// GET APPLICATION-OWNED PROCESSES
function getManagedProcesses() {

    return Array.from(managedProcesses.values()).map(item => ({
        pid: item.pid,
        name: item.name,
        status: item.status
    }));
}

export {
    startProcess,
    listProcesses,
    stopProcess,
    getManagedProcesses
};
