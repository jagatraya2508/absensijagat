async function ensureSystemRoles(pool) {
    await pool.query(`
        INSERT INTO roles (name, label, is_system)
        VALUES
            ('admin', 'Administrator', true),
            ('employee', 'Karyawan', true),
            ('manager', 'Pimpinan / Manager', true),
            ('kiosk', 'Operator Kiosk', true)
        ON CONFLICT (name) DO NOTHING
    `);

    await pool.query(`
        UPDATE roles
        SET label = 'Operator Kiosk', is_system = true
        WHERE name = 'kiosk' AND (label IS DISTINCT FROM 'Operator Kiosk' OR is_system IS DISTINCT FROM true)
    `);

    await pool.query(`
        INSERT INTO role_permissions (role_id, permission_key)
        SELECT r.id, 'admin.kiosk'
        FROM roles r
        WHERE r.name = 'kiosk'
        ON CONFLICT (role_id, permission_key) DO NOTHING
    `);

    await pool.query(`
        DELETE FROM role_permissions rp
        USING roles r
        WHERE rp.role_id = r.id
          AND r.name = 'kiosk'
          AND rp.permission_key <> 'admin.kiosk'
    `);
}

module.exports = { ensureSystemRoles };
