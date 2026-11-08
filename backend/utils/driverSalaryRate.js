async function findStandardSalary(db, { crewRole, division, department, position, vehicleTypeId, salaryType }) {
    const vehicleId = parseInt(vehicleTypeId, 10);
    if (!vehicleId) return null;
    const role = crewRole === 'kenek' ? 'kenek' : 'supir';
    const type = ['daily', 'weekly', 'monthly'].includes(salaryType) ? salaryType : 'daily';
    const result = await db.query(`
        SELECT r.standard_salary
        FROM driver_salary_rates r
        JOIN divisions dv ON dv.id = r.division_id
        JOIN departments dp ON dp.id = r.department_id
        JOIN positions ps ON ps.id = r.position_id
        WHERE r.crew_role = $1
          AND r.vehicle_type_id = $2
          AND r.salary_type = $3
          AND lower(btrim(dv.name)) = lower(btrim(COALESCE($4, '')))
          AND lower(btrim(dp.name)) = lower(btrim(COALESCE($5, '')))
          AND lower(btrim(ps.name)) = lower(btrim(COALESCE($6, '')))
        LIMIT 1
    `, [role, vehicleId, type, division || '', department || '', position || '']);
    if (!result.rows[0]) return null;
    const amount = parseFloat(result.rows[0].standard_salary);
    return Number.isNaN(amount) ? null : amount;
}

module.exports = { findStandardSalary };
