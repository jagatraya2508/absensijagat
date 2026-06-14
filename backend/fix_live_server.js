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

        // Upload files
        await ssh.putFile('./fix_columns.js', '/home/wisnu/absensijagat/backend/fix_columns.js');
        await ssh.putFile('./fix_leave_constraint.js', '/home/wisnu/absensijagat/backend/fix_leave_constraint.js');
        console.log('Script perbaikan berhasil diupload.');

        // Run fix_columns.js
        console.log('Menjalankan perbaikan kolom...');
        const res1 = await ssh.execCommand('node fix_columns.js', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log('Output Kolom:', res1.stdout);
        if (res1.stderr) console.error('Error Kolom:', res1.stderr);

        // Run fix_leave_constraint.js
        console.log('Menjalankan perbaikan tipe cuti...');
        const res2 = await ssh.execCommand('node fix_leave_constraint.js', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log('Output Cuti:', res2.stdout);
        if (res2.stderr) console.error('Error Cuti:', res2.stderr);

        // Restart PM2 just in case
        console.log('Restarting PM2 backend...');
        const res3 = await ssh.execCommand('pm2 restart backend', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log('PM2 restarted:', res3.stdout.substring(0, 100) + '...');

        ssh.dispose();
        console.log('Semua perbaikan di server live selesai!');
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
fixRemote();
