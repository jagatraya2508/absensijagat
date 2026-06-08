const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function setupPM2() {
    try {
        console.log('Menghubungkan ke server...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        console.log('Koneksi berhasil!\n');

        const cwd = '/home/wisnu/absensijagat';

        // 1. Buat ecosystem.config.js di server
        console.log('1. Membuat ecosystem.config.js...');
        const ecosystemContent = `module.exports = {
  apps: [
    {
      name: 'absensijagat-backend-5000',
      script: 'server.js',
      cwd: '${cwd}/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'absensijagat-frontend-3012',
      script: 'node_modules/.bin/serve',
      args: '-s dist -l 3012',
      cwd: '${cwd}/frontend',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};`;
        await ssh.execCommand(`cat > ${cwd}/ecosystem.config.js << 'EOF'
${ecosystemContent}
EOF`);
        console.log('   ecosystem.config.js dibuat!');

        // 2. Start PM2 processes
        console.log('\n2. Memulai PM2 processes baru...');
        
        // Hapus process lama jika ada dengan nama yang sama
        await ssh.execCommand(`pm2 delete absensijagat-backend-5000 2>/dev/null; pm2 delete absensijagat-frontend-3012 2>/dev/null`);
        
        // Start dengan ecosystem
        const startResult = await ssh.execCommand(`pm2 start ecosystem.config.js`, { cwd });
        console.log('   ', startResult.stdout);
        if (startResult.stderr) console.log('   stderr:', startResult.stderr);

        // 3. Save PM2 config
        console.log('\n3. Menyimpan PM2 config...');
        await ssh.execCommand('pm2 save');

        // 4. Cek status
        console.log('\n4. Status PM2:');
        const statusResult = await ssh.execCommand('pm2 list');
        console.log(statusResult.stdout);

        // 5. Cek port 3012
        console.log('\n5. Cek port 3012 listening:');
        const portCheck = await ssh.execCommand('ss -tlnp | grep 3012');
        console.log(portCheck.stdout || '   Port 3012 belum terdeteksi, tunggu beberapa detik...');

        // Tunggu sebentar lalu cek lagi
        await new Promise(r => setTimeout(r, 3000));
        const portCheck2 = await ssh.execCommand('ss -tlnp | grep 3012');
        console.log(portCheck2.stdout || '   Port 3012 masih belum terdeteksi');

        // 6. Cek log
        console.log('\n6. PM2 logs (last 5 lines):');
        const logs = await ssh.execCommand('pm2 logs absensijagat-frontend-3012 --lines 5 --nostream');
        console.log(logs.stdout);
        console.log(logs.stderr);

        console.log('\n============================');
        console.log('✅ SETUP SELESAI!');
        console.log('Akses di: http://203.194.114.152:3012');
        console.log('============================');

        ssh.dispose();
    } catch (e) {
        console.error('GAGAL:', e);
        ssh.dispose();
    }
}
setupPM2();
