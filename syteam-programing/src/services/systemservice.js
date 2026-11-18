import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function getWindowsHardwareInfo() {
    if (process.platform !== 'win32') return null;

    const command = [
        "$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed",
        "$computer = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model",
        "$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber",
        "[pscustomobject]@{ cpu = $cpu; computer = $computer; os = $os } | ConvertTo-Json -Compress -Depth 3"
    ].join('; ');

    try {
        const { stdout } = await execFileAsync(
            'powershell.exe',
            ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
            { windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024 }
        );
        return JSON.parse(stdout.trim());
    } catch {
        return null;
    }
}

async function getSystemInfo() {
    const cpus = os.cpus();
    const hardware = await getWindowsHardwareInfo();
    const cpu = hardware?.cpu;
    const computer = hardware?.computer;
    const operatingSystem = hardware?.os;

    return {
        computer: {
            hostname: os.hostname(),
            manufacturer: computer?.Manufacturer || 'Not available',
            model: computer?.Model || 'Not available'
        },
        operatingSystem: {
            platform: os.platform(),
            distro: operatingSystem?.Caption || `${os.type()} ${os.release()}`,
            release: operatingSystem?.Version
                ? `${operatingSystem.Version} (build ${operatingSystem.BuildNumber})`
                : os.release(),
            kernel: os.release(),
            architecture: os.arch()
        },
        processor: {
            manufacturer: cpu?.Manufacturer?.trim() || 'Not available',
            brand: cpu?.Name?.trim() || cpus[0]?.model || 'Not available',
            physicalCores: Number(cpu?.NumberOfCores) || cpus.length,
            logicalCores: Number(cpu?.NumberOfLogicalProcessors) || cpus.length,
            speed: Number(cpu?.MaxClockSpeed)
                ? Number((Number(cpu.MaxClockSpeed) / 1000).toFixed(2))
                : cpus[0]?.speed / 1000 || 0
        },
        memory: { total: os.totalmem() },
        uptime: os.uptime(),
        user: os.userInfo().username
    };
}

export { getSystemInfo };
