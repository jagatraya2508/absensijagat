const crypto = require('crypto');

// GUI Windows (tanpa CMD): tools/license-generator/License Generator.vbs
const LICENSE_SECRET = 'ABSENSI_LICENSE_SECRET_KEY_2026_XYZ_SECURE!';

function normalizeMachineId(value) {
    return String(value || '').toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 16);
}

function generateLicense(companyName, maxUsers, durationMonths, machineId) {
    const boundId = normalizeMachineId(machineId);
    if (boundId.length !== 16) {
        throw new Error('ID Mesin wajib diisi (16 karakter). Salin dari halaman License di aplikasi.');
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + parseInt(durationMonths));

    const payload = {
        company: companyName,
        max_users: parseInt(maxUsers),
        expires_at: expiresAt.toISOString(),
        issued_at: new Date().toISOString(),
        id: crypto.randomBytes(4).toString('hex'),
        machine_id: boundId
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');

    const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
    hmac.update(payloadBase64);
    const signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const licenseKey = `${payloadBase64}.${signature}`;

    console.log('\n--- LICENSE GENERATED SUCCESSFULLY ---\n');
    console.log(`Company     : ${payload.company}`);
    console.log(`Max Users   : ${payload.max_users}`);
    console.log(`Machine ID  : ${boundId.match(/.{1,4}/g).join('-')}`);
    console.log(`Expires At  : ${new Date(payload.expires_at).toLocaleString()}`);
    console.log(`License Key :\n\n${licenseKey}\n`);

    return licenseKey;
}

const args = process.argv.slice(2);
let company = 'Client Company';
let maxUsers = 10;
let months = 12;
let machineId = '';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i + 1]) {
        company = args[i + 1];
        i++;
    } else if (args[i] === '--max-users' && args[i + 1]) {
        maxUsers = args[i + 1];
        i++;
    } else if (args[i] === '--months' && args[i + 1]) {
        months = args[i + 1];
        i++;
    } else if ((args[i] === '--machine-id' || args[i] === '--machine') && args[i + 1]) {
        machineId = args[i + 1];
        i++;
    }
}

if (args.includes('--help')) {
    console.log('Usage: node generate-license.js --company "Name" --max-users 100 --months 12 --machine-id ABCD-EF01-2345-6789');
} else {
    try {
        generateLicense(company, maxUsers, months, machineId);
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = { LICENSE_SECRET, generateLicense };
