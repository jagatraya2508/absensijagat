require('dotenv').config();
const jwt = require('jsonwebtoken');

async function test() {
    try {
        const secret = process.env.JWT_SECRET || 'secret123';
        console.log('Using secret:', secret);
        const token = jwt.sign(
            { id: 2, employee_id: 'ADMIN001', role: 'admin' },
            secret,
            { expiresIn: '1h' }
        );

        const res = await fetch('http://localhost:5000/api/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response body:', text);
    } catch (e) {
        console.error(e);
    }
}

test();
