const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function deploy() {
    try {
        console.log('Menghubungkan ke server 203.194.114.152...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        console.log('Koneksi SSH berhasil!');

        // 1. Cek apakah folder absensijagat sudah ada
        console.log('Mengecek folder absensijagat...');
        const checkFolder = await ssh.execCommand('ls -d absensijagat', { cwd: '/home/wisnu' });
        
        let targetCwd = '/home/wisnu/absensijagat';
        if (checkFolder.stderr && checkFolder.stderr.includes('No such file or directory')) {
            console.log('Folder tidak ditemukan, melakukan git clone...');
            const cloneResult = await ssh.execCommand('git clone https://github.com/jagatraya2508/absensijagat.git absensijagat', { cwd: '/home/wisnu' });
            console.log('Clone output:', cloneResult.stdout);
            console.log('Clone error:', cloneResult.stderr);
        } else {
            console.log('Folder absensijagat ditemukan. Melakukan pull update terbaru...');
            // Asumsikan targetCwd sudah benar (tergantung user default home, kalau bukan di /home/wisnu, kita mungkin perlu ganti `cwd: '.'`)
            // Kita coba pakai relative path ke home user
        }

        // Jalankan semua command relatif terhadap direktori default user
        const checkPwd = await ssh.execCommand('pwd');
        const defaultPath = checkPwd.stdout.trim();
        targetCwd = `${defaultPath}/absensijagat`;

        if (!checkFolder.stdout.includes('absensijagat')) {
             console.log('Folder tidak ditemukan di default dir, melakukan git clone...');
             const cloneResult = await ssh.execCommand('git clone https://github.com/jagatraya2508/absensijagat.git absensijagat', { cwd: defaultPath });
             console.log('Clone:', cloneResult.stdout, cloneResult.stderr);
        } else {
             console.log('Folder ada. Git pull...');
             const pullResult = await ssh.execCommand('git pull origin main', { cwd: targetCwd });
             console.log('Pull:', pullResult.stdout, pullResult.stderr);
        }

        // 2. Setting Port dan Env
        // Cek apakah server menggunakan docker-compose
        console.log('Mengonfigurasi .env port 3012...');
        const envScript = `
        touch .env
        sed -i '/^FRONTEND_PORT=/d' .env
        echo "FRONTEND_PORT=3012" >> .env
        `;
        await ssh.execCommand(envScript, { cwd: targetCwd });

        // 3. Menjalankan Update script (menginstall module dan build)
        console.log('Menjalankan chmod pada update.sh dan mengeksekusinya...');
        await ssh.execCommand('chmod +x update.sh', { cwd: targetCwd });
        
        console.log('Mengeksekusi update.sh (Ini mungkin memakan waktu beberapa menit)...');
        // Kita tangkap outputnya
        const updateResult = await ssh.execCommand('./update.sh', { cwd: targetCwd });
        console.log('Update stdout:\n', updateResult.stdout);
        if (updateResult.stderr) {
            console.log('Update stderr:\n', updateResult.stderr);
        }

        // 4. Jika menggunakan docker-compose, jalankan juga just in case
        console.log('Mencoba menjalankan dengan docker-compose jika tersedia...');
        const dockerResult = await ssh.execCommand('docker-compose up -d --build', { cwd: targetCwd });
        console.log('Docker stdout:', dockerResult.stdout);
        console.log('Docker stderr:', dockerResult.stderr);

        console.log('Deployment script selesai.');
        ssh.dispose();

    } catch (error) {
        console.error('Terjadi kesalahan:', error);
        ssh.dispose();
    }
}

deploy();
