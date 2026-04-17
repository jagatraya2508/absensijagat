// Test the actual API endpoint
const http = require('http');

// First login to get token
const loginData = JSON.stringify({ employee_id: 'ADMIN001', password: 'admin123' });

const loginReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            if (result.token) {
                console.log('Login OK, testing employee save...');
                testSave(result.token);
            } else {
                console.log('Login failed:', data);
                process.exit(1);
            }
        } catch(e) {
            console.log('Login response:', data);
            process.exit(1);
        }
    });
});
loginReq.write(loginData);
loginReq.end();

function testSave(token) {
    // First get an employee
    const getReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/employees',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const employees = JSON.parse(data);
            if (employees.length === 0) {
                console.log('No employees');
                process.exit();
            }
            const empId = employees[0].id;
            console.log('Testing with employee:', employees[0].name, 'id:', empId);
            
            // Now try to save driver data
            const saveData = JSON.stringify({
                is_driver: true,
                driver_subuh_allowance: 25000,
                driver_rit_allowance: 15000,
                driver_inap_allowance: 50000,
                basic_salary: 5000000,
                salary_type: 'monthly',
                transport_allowance: 0,
                meal_allowance: 0,
                overtime_rate: 50000,
                tax_status: 'TK/0',
                location_ids: []
            });

            const saveReq = http.request({
                hostname: 'localhost',
                port: 3000,
                path: '/api/employees/' + empId,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    console.log('Save status:', res.statusCode);
                    console.log('Save response:', body);
                    
                    // Now read it back
                    const readReq = http.request({
                        hostname: 'localhost',
                        port: 3000,
                        path: '/api/employees/' + empId,
                        method: 'GET',
                        headers: { 'Authorization': 'Bearer ' + token }
                    }, (res2) => {
                        let body2 = '';
                        res2.on('data', chunk => body2 += chunk);
                        res2.on('end', () => {
                            const emp = JSON.parse(body2);
                            console.log('\nRead back driver fields:');
                            console.log('  is_driver:', emp.details?.is_driver);
                            console.log('  driver_subuh_allowance:', emp.details?.driver_subuh_allowance);
                            console.log('  driver_rit_allowance:', emp.details?.driver_rit_allowance);
                            console.log('  driver_inap_allowance:', emp.details?.driver_inap_allowance);
                            process.exit();
                        });
                    });
                    readReq.end();
                });
            });
            saveReq.write(saveData);
            saveReq.end();
        });
    });
    getReq.end();
}
