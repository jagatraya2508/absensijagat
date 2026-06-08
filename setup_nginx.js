const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function setupNginx() {
    try {
        console.log('Menghubungkan ke server...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        console.log('Koneksi berhasil!\n');

        const SUDO = 'echo "sa" | sudo -S';

        // 1. Hapus PM2 frontend serve (tidak perlu lagi, nginx akan serve static files)
        console.log('1. Menghapus PM2 frontend serve (akan diganti Nginx)...');
        await ssh.execCommand('pm2 delete absensijagat-frontend-3012');
        await ssh.execCommand('pm2 save');
        console.log('   Done.');

        // 2. Buat Nginx config
        console.log('2. Membuat konfigurasi Nginx...');
        const nginxConfig = `server {
    listen 3012;
    server_name _;

    root /home/wisnu/absensijagat/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # API proxy ke backend
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }

    # Uploads proxy ke backend
    location /uploads/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA - semua route lain diarahkan ke index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}`;

        // Tulis config ke /etc/nginx/sites-available/
        await ssh.execCommand(`${SUDO} tee /etc/nginx/sites-available/absensijagat > /dev/null << 'NGINXEOF'
${nginxConfig}
NGINXEOF`);
        console.log('   Config ditulis ke /etc/nginx/sites-available/absensijagat');

        // 3. Enable site (symlink)
        console.log('3. Mengaktifkan site...');
        await ssh.execCommand(`${SUDO} ln -sf /etc/nginx/sites-available/absensijagat /etc/nginx/sites-enabled/absensijagat`);
        console.log('   Symlink dibuat.');

        // 4. Test nginx config
        console.log('4. Mengetes konfigurasi Nginx...');
        const testResult = await ssh.execCommand(`${SUDO} nginx -t`);
        console.log('   ', testResult.stderr || testResult.stdout);

        // 5. Reload nginx
        console.log('5. Mereload Nginx...');
        const reloadResult = await ssh.execCommand(`${SUDO} systemctl reload nginx`);
        console.log('   Nginx berhasil di-reload!');

        // 6. Pastikan backend PM2 masih jalan dengan .env yang benar
        console.log('6. Memastikan backend jalan...');
        const pm2Status = await ssh.execCommand('pm2 list | grep absensijagat');
        console.log('   ', pm2Status.stdout);

        // 7. Cek port 3012
        console.log('7. Cek port 3012...');
        const portCheck = await ssh.execCommand('ss -tlnp | grep 3012');
        console.log('   ', portCheck.stdout);

        console.log('\n============================');
        console.log('✅ NGINX SETUP SELESAI!');
        console.log('Akses di: http://203.194.114.152:3012');
        console.log('============================');

        ssh.dispose();
    } catch (e) {
        console.error('GAGAL:', e);
        ssh.dispose();
    }
}
setupNginx();
