const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

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
    try {
        if (fs.existsSync('/etc/machine-id')) {
            const id = fs.readFileSync('/etc/machine-id', 'utf8').trim();
            if (id) return `linux:${id}`;
        }
    } catch (_) { /* ignore */ }

    if (process.platform === 'win32') {
        const guid = readWindowsMachineGuid();
        if (guid) return `win:${guid}`;
    }

    const macs = Object.values(os.networkInterfaces() || {})
        .flat()
        .filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00')
        .map((n) => n.mac)
        .sort();

    return `fallback:${os.hostname()}|${macs[0] || 'nomac'}`;
}

function getMachineId() {
    return hashId(getRawMachineSource());
}

module.exports = {
    getMachineId,
    normalizeMachineId,
    formatMachineId,
    machineIdsMatch
};
