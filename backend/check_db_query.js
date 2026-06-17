const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkRemote() {
    try {
        await ssh.connect({
            host: '203.194.114.152',
            username: 'wisnu',
            password: 'sa',
        });
        
        console.log('--- Execute Query on Live Server ---');
        const script = `
const { pool } = require('./db');
async function run() {
    try {
        const res = await pool.query("SELECT photo FROM users LIMIT 1");
        console.log('Query successful, photo value:', res.rows[0] ? res.rows[0].photo : 'null/undefined/no rows');
        
        // Let's also check the schema of 'users'
        const res2 = await pool.query("SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_name='users'");
        console.log('Columns:');
        console.table(res2.rows);
    } catch(e) {
        console.error('Query failed:', e.message);
    } finally {
        pool.end();
    }
}
run();
`;
        await ssh.execCommand(`echo "${script.replace(/"/g, '\\"')}" > check_query_temp.js`, { cwd: '/home/wisnu/absensijagat/backend' });
        const res = await ssh.execCommand('node check_query_temp.js', { cwd: '/home/wisnu/absensijagat/backend' });
        console.log(res.stdout);
        console.log(res.stderr);

        ssh.dispose();
    } catch (e) {
        console.error('Error:', e);
        ssh.dispose();
    }
}
checkRemote();
