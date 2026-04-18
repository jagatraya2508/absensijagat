const crypto = require('crypto');

// Secret key hardcoded in the backend. In a real scenario, this could be
// obfuscated or compiled, but for now we'll store it explicitly here
// and ensure it's not exposed to the client.
const LICENSE_SECRET = 'ABSENSI_LICENSE_SECRET_KEY_2026_XYZ_SECURE!';

function generateLicense(companyName, maxUsers, durationMonths) {
    // Determine expiration date
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + parseInt(durationMonths));
    
    const payload = {
        company: companyName,
        max_users: parseInt(maxUsers),
        expires_at: expiresAt.toISOString(),
        issued_at: new Date().toISOString(),
        id: crypto.randomBytes(4).toString('hex') // unique id part
    };
    
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    // Generate signature
    const hmac = crypto.createHmac('sha256', LICENSE_SECRET);
    hmac.update(payloadBase64);
    const signature = hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const licenseKey = `${payloadBase64}.${signature}`;
    
    console.log('\n--- LICENSE GENERATED SUCCESSFULLY ---\n');
    console.log(`Company     : ${payload.company}`);
    console.log(`Max Users   : ${payload.max_users}`);
    console.log(`Expires At  : ${new Date(payload.expires_at).toLocaleString()}`);
    console.log(`License Key :\n\n${licenseKey}\n`);
    
    return licenseKey;
}

// Simple CLI parser
const args = process.argv.slice(2);
let company = 'Client Company';
let maxUsers = 10;
let months = 12;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i+1]) {
        company = args[i+1];
        i++;
    } else if (args[i] === '--max-users' && args[i+1]) {
        maxUsers = args[i+1];
        i++;
    } else if (args[i] === '--months' && args[i+1]) {
        months = args[i+1];
        i++;
    }
}

if (args.includes('--help')) {
    console.log(`Usage: node generate-license.js --company "Name" --max-users 100 --months 12`);
} else {
    generateLicense(company, maxUsers, months);
}

module.exports = { LICENSE_SECRET };
