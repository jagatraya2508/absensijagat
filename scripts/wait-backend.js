const net = require('net');
const fs = require('fs');
const path = require('path');

function readBackendPort() {
    if (process.env.PORT) return Number(process.env.PORT);

    const envPath = path.join(__dirname, '..', 'backend', '.env');
    try {
        const match = fs.readFileSync(envPath, 'utf8').match(/^PORT=(.+)$/m);
        if (match) return Number(String(match[1]).trim());
    } catch {
        // backend/.env may not exist in all environments
    }

    return 5000;
}

const host = '127.0.0.1';
const port = readBackendPort();
const deadline = Date.now() + 90000;

function tryConnect() {
    const socket = net.connect({ host, port }, () => {
        socket.end();
        process.exit(0);
    });

    socket.setTimeout(1500);
    socket.on('timeout', () => {
        socket.destroy();
        retryOrContinue();
    });

    socket.on('error', () => {
        socket.destroy();
        retryOrContinue();
    });
}

function retryOrContinue() {
    if (Date.now() > deadline) {
        console.warn(`Backend belum siap di ${host}:${port}. Frontend tetap dijalankan.`);
        process.exit(0);
    }
    setTimeout(tryConnect, 500);
}

tryConnect();
