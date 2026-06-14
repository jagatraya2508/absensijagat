const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixAndDeployLive() {
    try {
        console.log('Menghubungkan ke server live (203.194.114.152)...');
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('Berhasil terhubung. Memperbaiki git conflicts...');
        
        // 1. Remove conflicting file and pull latest
        const gitRes = await ssh.execCommand('rm -f backend/fix_leave_constraint.js && git pull origin main', { cwd: '/home/wisnu/absensijagat' });
        console.log('Git Output:\n', gitRes.stdout);
        if (gitRes.stderr) console.error('Git Error:\n', gitRes.stderr);

        // 2. Run update script with bash
        console.log('Menjalankan update.sh...');
        const updateRes = await ssh.execCommand('bash ./update.sh', { cwd: '/home/wisnu/absensijagat' });
        console.log('Update Output:\n', updateRes.stdout);
        if (updateRes.stderr) console.error('Update Error:\n', updateRes.stderr);

        ssh.dispose();
        console.log('Selesai perbaikan dan update server live!');
    } catch (e) {
        console.error('SSH Error:', e);
        ssh.dispose();
    }
}
fixAndDeployLive();
