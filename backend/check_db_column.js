const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkRemote() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('--- Check Users Columns ---');
        // We'll run a quick node script on the server to check the DB schema
        const script = `
const { pool } = require('./db');
async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users';");
        console.log('Columns in users:', res.rows.map(r => r.column_name).join(', '));
    } catch(e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
`;
        await ssh.execCommand(`echo "${script.replace(/"/g, '\\"')}" > check_schema_temp.js`, { cwd: '/home/wisnu/absensijagat/backend' });
        const res = await ssh.execCommand('node check_schema_temp.js', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log(res.stdout);
        console.log(res.stderr);

        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
checkRemote();
