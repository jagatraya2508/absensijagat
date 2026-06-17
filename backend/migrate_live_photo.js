const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixRemote() {
    try {
        console.log('Connecting to remote server...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('Connected to remote server!');

        // Upload file
        await ssh.putFile('./migrate_user_photo.js', '/home/wisnu/absensijagat/backend/migrate_user_photo.js');
        console.log('Script migrate_user_photo.js berhasil diupload.');

        // Run migrate_user_photo.js
        console.log('Menjalankan migrasi kolom photo...');
        const res = await ssh.execCommand('node migrate_user_photo.js', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log('Output Migrasi:', res.stdout);
        if (res.stderr) console.error('Error Migrasi:', res.stderr);

        // Restart PM2
        console.log('Restarting PM2 backend...');
        const res2 = await ssh.execCommand('pm2 restart backend', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log('PM2 restarted:', res2.stdout.substring(0, 100) + '...');

        ssh.dispose();
        console.log('Migrasi di server live selesai!');
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
fixRemote();
