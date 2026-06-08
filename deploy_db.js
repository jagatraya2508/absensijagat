const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

const DUMP_FILE = path.join('d:', 'Programer', 'absensijagat', 'absensijagat_dump.sql');
const REMOTE_DUMP = '/tmp/absensijagat_dump.sql';
const SUDO_PASS = 'sa';
const DB_NAME = 'absensijagat';
const DB_PASSWORD = 'sa'; // password untuk user postgres di server

async function deploy() {
    try {
        console.log('1. Menghubungkan ke server...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        console.log('   Koneksi berhasil!');

        // 2. Upload file dump ke server
        console.log('2. Mengunggah file dump ke server...');
        await ssh.putFile(DUMP_FILE, REMOTE_DUMP);
        console.log('   Upload selesai!');

        // 3. Set password postgres agar bisa diakses oleh aplikasi
        console.log('3. Mengatur password user postgres di server...');
        const setPassResult = await ssh.execCommand(
            `echo "${SUDO_PASS}" | sudo -S -u postgres psql -c "ALTER USER postgres PASSWORD '${DB_PASSWORD}';"` 
        );
        console.log('   Set password:', setPassResult.stdout);
        if (setPassResult.stderr && !setPassResult.stderr.includes('[sudo]')) {
            console.log('   stderr:', setPassResult.stderr);
        }

        // 4. Drop database lama jika ada, lalu buat baru
        console.log('4. Menghapus database lama (jika ada) dan membuat database baru...');
        // Terminate existing connections
        const termResult = await ssh.execCommand(
            `echo "${SUDO_PASS}" | sudo -S -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();"`
        );
        console.log('   Terminate connections:', termResult.stdout);

        const dropResult = await ssh.execCommand(
            `echo "${SUDO_PASS}" | sudo -S -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};"`
        );
        console.log('   Drop database:', dropResult.stdout);

        const createResult = await ssh.execCommand(
            `echo "${SUDO_PASS}" | sudo -S -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER postgres;"`
        );
        console.log('   Create database:', createResult.stdout);

        // 5. Import dump
        console.log('5. Mengimpor data ke database (ini mungkin memakan waktu)...');
        const importResult = await ssh.execCommand(
            `echo "${SUDO_PASS}" | sudo -S -u postgres psql -d ${DB_NAME} -f ${REMOTE_DUMP}`
        );
        console.log('   Import stdout:', importResult.stdout.substring(0, 500));
        if (importResult.stderr) {
            // Filter hanya error serius, bukan warning
            const errors = importResult.stderr.split('\n').filter(l => l.includes('ERROR'));
            if (errors.length > 0) {
                console.log('   Import errors:', errors.join('\n'));
            } else {
                console.log('   Import selesai (ada beberapa warning minor, tidak masalah).');
            }
        }

        // 6. Konfigurasi .env di server
        console.log('6. Mengonfigurasi .env di server...');
        const envContent = `# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Server Port
PORT=5000

# SMTP Configuration for Email Sender
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_anda@gmail.com
SMTP_PASS=password_aplikasi_anda
`;
        await ssh.execCommand(`cat > /home/wisnu/absensijagat/backend/.env << 'ENVEOF'
${envContent}
ENVEOF`);
        console.log('   .env berhasil dikonfigurasi!');

        // 7. Restart PM2
        console.log('7. Merestart aplikasi (PM2)...');
        const pm2Result = await ssh.execCommand('pm2 restart all');
        console.log('   PM2:', pm2Result.stdout);

        // 8. Cleanup
        console.log('8. Membersihkan file sementara...');
        await ssh.execCommand(`rm -f ${REMOTE_DUMP}`);
        
        console.log('\n============================');
        console.log('✅ DATABASE BERHASIL DIPASANG DI SERVER!');
        console.log('============================');

        ssh.dispose();
    } catch (error) {
        console.error('GAGAL:', error);
        ssh.dispose();
    }
}

deploy();
