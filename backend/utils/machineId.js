const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const PERSIST_FILE = process.env.LICENSE_MACHINE_ID_FILE
    || path.join(__dirname, '..', '.machine-id');

function hashId(raw) {
    return crypto.createHash('sha256').update(String(raw).trim()).digest('hex').slice(0, 16).toUpperCase();
}

function normalizeMachineId(value) {
    return String(value || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 16);
}

function formatMachineId(value) {
    const hex = normalizeMachineId(value);
    if (hex.length !== 16) return hex;
    return hex.match(/.{1,4}/g).join('-');
}

function machineIdsMatch(a, b) {
    const left = normalizeMachineId(a);
    const right = normalizeMachineId(b);
    return left.length === 16 && left === right;
}

function isDocker() {
    try {
        if (fs.existsSync('/.dockerenv')) return true;
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
        if (/docker|containerd|kubepods/i.test(cgroup)) return true;
    } catch (_) { /* ignore */ }
    return false;
}

function readPersistedId() {
    try {
        if (!fs.existsSync(PERSIST_FILE)) return null;
        const id = normalizeMachineId(fs.readFileSync(PERSIST_FILE, 'utf8'));
        return id.length === 16 ? id : null;
    } catch (_) {
        return null;
    }
}

function writePersistedId(id) {
    const hex = normalizeMachineId(id);
    if (hex.length !== 16) return;
    try {
        fs.writeFileSync(PERSIST_FILE, formatMachineId(hex) + '\n', { encoding: 'utf8', mode: 0o600 });
    } catch (_) { /* volume may be read-only */ }
}

function readTextIfExists(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const text = fs.readFileSync(filePath, 'utf8').trim();
        return text || null;
    } catch (_) {
        return null;
    }
}

function readWindowsMachineGuid() {
    try {
        const out = execSync(
            'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
            { encoding: 'utf8', windowsHide: true, timeout: 5000 }
        );
        const match = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/i);
        if (match) return match[1].trim();
    } catch (_) { /* ignore */ }
    return null;
}

function getRawMachineSource() {
    const docker = isDocker();

    const hostMachineId = readTextIfExists('/host/etc/machine-id')
        || readTextIfExists('/host/machine-id');
    if (hostMachineId) return `host:${hostMachineId}`;

    if (!docker) {
        const localMachineId = readTextIfExists('/etc/machine-id');
        if (localMachineId) return `linux:${localMachineId}`;
    }

    if (process.platform === 'win32') {
        const guid = readWindowsMachineGuid();
        if (guid) return `win:${guid}`;
    }

    if (docker) {
        return `docker:${crypto.randomBytes(16).toString('hex')}`;
    }

    const macs = Object.values(os.networkInterfaces() || {})
        .flat()
        .filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00')
        .map((n) => n.mac)
        .sort();

    return `fallback:${os.hostname()}|${macs[0] || 'nomac'}`;
}

function getMachineId() {
    const fromEnv = normalizeMachineId(process.env.LICENSE_MACHINE_ID);
    if (fromEnv.length === 16) {
        writePersistedId(fromEnv);
        return fromEnv;
    }

    const persisted = readPersistedId();
    if (persisted) return persisted;

    const computed = hashId(getRawMachineSource());
    writePersistedId(computed);
    return computed;
}

module.exports = {
    getMachineId,
    normalizeMachineId,
    formatMachineId,
    machineIdsMatch
};
