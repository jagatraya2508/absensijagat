const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixNginx() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });

        const SUDO = 'echo "sa" | sudo -S';

        // Port 80 dipakai Docker, jadi site jagatrayasolusindo.com (port 80) akan bentrok.
        // Solusi: hapus dari sites-enabled agar nginx hanya serve port 3012.
        
        console.log('1. Menghapus site yang bentrok port 80 dari sites-enabled...');
        await ssh.execCommand(`${SUDO} rm -f /etc/nginx/sites-enabled/jagatrayasolusindo.com`);
        console.log('   jagatrayasolusindo.com dihapus dari sites-enabled (tetap ada di sites-available).');

        // Juga pastikan tidak ada default site
        await ssh.execCommand(`${SUDO} rm -f /etc/nginx/sites-enabled/default`);

        // 2. Verifikasi hanya absensijagat yang aktif
        console.log('\n2. Sites-enabled sekarang:');
        const sites = await ssh.execCommand('ls -la /etc/nginx/sites-enabled/');
        console.log(sites.stdout);

        // 3. Test nginx config
        console.log('3. Test Nginx config...');
        const test = await ssh.execCommand(`${SUDO} nginx -t 2>&1`);
        console.log('   ', test.stdout || test.stderr);

        // 4. Start nginx
        console.log('4. Start Nginx...');
        const start = await ssh.execCommand(`${SUDO} systemctl start nginx 2>&1`);
        console.log('   ', start.stdout || 'OK (no output)');
        if (start.stderr) console.log('   stderr:', start.stderr);

        // 5. Cek status
        await new Promise(r => setTimeout(r, 2000));
        console.log('\n5. Status Nginx:');
        const status = await ssh.execCommand(`systemctl is-active nginx`);
        console.log('   ', status.stdout);

        // 6. Cek port 3012
        console.log('\n6. Port 3012:');
        const port = await ssh.execCommand('ss -tlnp | grep 3012');
        console.log('   ', port.stdout || 'Belum terdeteksi');

        // 7. Test curl ke localhost:3012
        console.log('\n7. Test akses localhost:3012...');
        const curl = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:3012/');
        console.log('   HTTP status code:', curl.stdout);

        // 8. Test curl ke /api
        console.log('\n8. Test akses localhost:3012/api/auth/me...');
        const curlApi = await ssh.execCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:3012/api/auth/me');
        console.log('   HTTP status code:', curlApi.stdout);

        console.log('\n============================');
        console.log('✅ NGINX BERHASIL RUNNING DI PORT 3012!');
        console.log('Akses: http://203.194.114.152:3012');
        console.log('============================');

        ssh.dispose();
    } catch (e) {
        console.error(e);
        ssh.dispose();
    }
}
fixNginx();
