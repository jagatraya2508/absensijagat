require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function seedTracking() {
    const client = await pool.connect();
    try {
        // Find driver users
        const drivers = await client.query(`
            SELECT u.id, u.name, u.employee_id 
            FROM users u 
            JOIN employee_details ed ON u.id = ed.user_id 
            WHERE ed.is_driver = true
            ORDER BY u.name
        `);

        if (drivers.rows.length === 0) {
            console.log('❌ Tidak ada driver ditemukan di database');
            return;
        }

        console.log(`✅ Ditemukan ${drivers.rows.length} driver:`);
        drivers.rows.forEach(d => console.log(`   - ${d.name} (${d.employee_id}) [id: ${d.id}]`));

        const driverId = drivers.rows[0].id;
        const driverName = drivers.rows[0].name;
        console.log(`\n🚛 Menggunakan driver: ${driverName} (id: ${driverId})`);

        await client.query('BEGIN');

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

        // === DATA HARI INI ===
        // 1. Tracking completed (sudah check-out)
        await client.query(`
            INSERT INTO driver_tracking 
            (user_id, tracking_date, customer_name, address, 
             checkin_time, checkin_latitude, checkin_longitude,
             checkout_time, checkout_latitude, checkout_longitude,
             notes, status)
            VALUES ($1, $2, 'PT Maju Jaya', 'Jl. Raya Industri No. 45, Bekasi',
                    $2::date + TIME '08:15', -6.2415, 106.9876,
                    $2::date + TIME '09:30', -6.2420, 106.9880,
                    'Barang sudah diterima oleh Pak Budi', 'completed')
        `, [driverId, today]);

        // 2. Tracking completed (sudah check-out)
        await client.query(`
            INSERT INTO driver_tracking 
            (user_id, tracking_date, customer_name, address,
             checkin_time, checkin_latitude, checkin_longitude,
             checkout_time, checkout_latitude, checkout_longitude,
             notes, status)
            VALUES ($1, $2, 'Toko Makmur Sentosa', 'Jl. Pasar Baru No. 12, Jakarta Pusat',
                    $2::date + TIME '10:05', -6.1685, 106.8451,
                    $2::date + TIME '11:20', -6.1690, 106.8455,
                    'Delivery 20 box, diterima oleh Ibu Sari', 'completed')
        `, [driverId, today]);

        // 3. Tracking masih aktif (belum check-out)
        await client.query(`
            INSERT INTO driver_tracking 
            (user_id, tracking_date, customer_name, address,
             checkin_time, checkin_latitude, checkin_longitude,
             notes, status)
            VALUES ($1, $2, 'CV Berkah Abadi', 'Jl. Industri Raya No. 88, Tangerang',
                    $2::date + TIME '13:00', -6.1780, 106.6320,
                    'Menunggu loading barang', 'checked_in')
        `, [driverId, today]);

        // === DATA KEMARIN ===
        await client.query(`
            INSERT INTO driver_tracking 
            (user_id, tracking_date, customer_name, address,
             checkin_time, checkin_latitude, checkin_longitude,
             checkout_time, checkout_latitude, checkout_longitude,
             notes, status)
            VALUES ($1, $2, 'PT Sumber Rezeki', 'Jl. Gatot Subroto Km. 5, Bandung',
                    $2::date + TIME '07:45', -6.9175, 107.6191,
                    $2::date + TIME '09:00', -6.9180, 107.6195,
                    'Pengiriman 15 karton', 'completed')
        `, [driverId, yesterday]);

        await client.query(`
            INSERT INTO driver_tracking 
            (user_id, tracking_date, customer_name, address,
             checkin_time, checkin_latitude, checkin_longitude,
             checkout_time, checkout_latitude, checkout_longitude,
             notes, status)
            VALUES ($1, $2, 'UD Sentral Jaya', 'Jl. Ahmad Yani No. 100, Cimahi',
                    $2::date + TIME '10:30', -6.8823, 107.5385,
                    $2::date + TIME '12:15', -6.8828, 107.5390,
                    'Barang dikirim lengkap', 'completed')
        `, [driverId, yesterday]);

        // === DATA 2 HARI LALU ===
        await client.query(`
            INSERT INTO driver_tracking 
            (user_id, tracking_date, customer_name, address,
             checkin_time, checkin_latitude, checkin_longitude,
             checkout_time, checkout_latitude, checkout_longitude,
             notes, status)
            VALUES ($1, $2, 'Toko Bangunan Sejahtera', 'Jl. Margonda Raya No. 55, Depok',
                    $2::date + TIME '08:00', -6.3700, 106.8316,
                    $2::date + TIME '08:45', -6.3705, 106.8320,
                    'Delivery material bangunan', 'completed')
        `, [driverId, twoDaysAgo]);

        await client.query(`
            INSERT INTO driver_tracking 
            (user_id, tracking_date, customer_name, address,
             checkin_time, checkin_latitude, checkin_longitude,
             checkout_time, checkout_latitude, checkout_longitude,
             notes, status)
            VALUES ($1, $2, 'PT Global Elektronik', 'Jl. TB Simatupang No. 22, Jakarta Selatan',
                    $2::date + TIME '10:00', -6.2933, 106.8377,
                    $2::date + TIME '11:30', -6.2938, 106.8380,
                    'Pengiriman spare part elektronik', 'completed')
        `, [driverId, twoDaysAgo]);

        await client.query('COMMIT');

        // Verify
        const count = await client.query('SELECT COUNT(*) as total FROM driver_tracking WHERE user_id = $1', [driverId]);
        console.log(`\n✅ SUCCESS! ${count.rows[0].total} data tracking berhasil ditambahkan`);
        console.log('\n📋 Summary:');
        console.log(`   - Hari ini (${today}): 3 records (2 selesai, 1 aktif)`);
        console.log(`   - Kemarin (${yesterday}): 2 records (selesai)`);
        console.log(`   - 2 hari lalu (${twoDaysAgo}): 2 records (selesai)`);
        console.log('\n🔄 Silakan refresh halaman Admin Tracking Driver untuk melihat datanya!');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Error:', e.message);
    } finally {
        client.release();
        process.exit();
    }
}

seedTracking();
