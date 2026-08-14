async function ensureCustomerCodeSettings(client) {
    await client.query(`
        INSERT INTO app_settings (key, value, updated_at) VALUES
            ('customer_code_prefix', 'CUST', NOW()),
            ('customer_code_next', '1', NOW()),
            ('customer_code_digits', '4', NOW())
        ON CONFLICT (key) DO NOTHING
    `);
}

async function generateCustomerCode(client) {
    await ensureCustomerCodeSettings(client);

    const prefixRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_prefix'`);
    const digitsRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_digits'`);
    const prefix = prefixRes.rows[0]?.value || 'CUST';
    const digits = parseInt(digitsRes.rows[0]?.value || '4', 10) || 4;

    for (let attempt = 0; attempt < 40; attempt++) {
        const nextRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_next'`);
        let next = parseInt(nextRes.rows[0]?.value || '1', 10);
        if (!Number.isFinite(next) || next < 1) next = 1;

        const code = prefix + String(next).padStart(digits, '0');

        await client.query(
            `INSERT INTO app_settings (key, value, updated_at)
             VALUES ('customer_code_next', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [String(next + 1)]
        );

        const exists = await client.query(
            'SELECT 1 FROM customers WHERE customer_code = $1 LIMIT 1',
            [code]
        );
        if (exists.rows.length === 0) return code;
    }

    throw new Error('Gagal membuat kode customer unik');
}

async function advanceCounterIfNeeded(client, code) {
    if (!code) return;
    await ensureCustomerCodeSettings(client);
    const prefixRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_prefix'`);
    const nextRes = await client.query(`SELECT value FROM app_settings WHERE key = 'customer_code_next'`);
    const prefix = prefixRes.rows[0]?.value || 'CUST';
    if (!code.toUpperCase().startsWith(String(prefix).toUpperCase())) return;

    const numPart = code.slice(prefix.length);
    if (!/^\d+$/.test(numPart)) return;

    const n = parseInt(numPart, 10);
    const next = parseInt(nextRes.rows[0]?.value || '1', 10);
    if (n >= next) {
        await client.query(
            `INSERT INTO app_settings (key, value, updated_at)
             VALUES ('customer_code_next', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [String(n + 1)]
        );
    }
}

module.exports = {
    ensureCustomerCodeSettings,
    generateCustomerCode,
    advanceCounterIfNeeded
};
