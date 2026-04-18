const fs = require('fs');

async function main() {
  const filePath = 'd:/absensi/frontend/src/pages/AdminWorkSchedule.jsx';
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Add states
  if (!content.includes('const [positions, setPositions]')) {
    content = content.replace('const [departments, setDepartments] = useState([]);', 
        "const [departments, setDepartments] = useState([]);\n    const [positions, setPositions] = useState([]);");
  }

  // 2. Add fetchPositions
  if (!content.includes('const fetchPositions = useCallback')) {
    content = content.replace('const fetchDepartments = useCallback(async () => {', 
        `const fetchPositions = useCallback(async () => {
        try {
            const res = await fetch(\`\${API}/positions\`, { headers: { Authorization: \`Bearer \${token}\` } });
            const data = await res.json();
            if (res.ok) setPositions(data.map(p => p.name));
        } catch (e) { console.error(e); }
    }, [token]);

    const fetchDepartments = useCallback(async () => {`);
  }

  // 3. Add to useEffect dependency
  if (!content.includes('fetchPositions();')) {
      content = content.replace('fetchDepartments();', 'fetchDepartments();\n        fetchPositions();');
  }
  if (!content.includes('fetchPositions,')) {
      content = content.replace('fetchDepartments,', 'fetchDepartments, fetchPositions,');
  }

  // 4. Update scheduleForm definitions
  content = content.replace(
      "id: null, name: '', type: 'normal', shift_count: 1, department: '', is_default: false,", 
      "id: null, name: '', type: 'normal', shift_count: 1, department: '', position: '', is_default: false,"
  );
  // It occurs twice (one in useState, one in openNewSchedule)
  content = content.replace(
      "id: null, name: '', type: 'normal', shift_count: 1, department: '', is_default: false,", 
      "id: null, name: '', type: 'normal', shift_count: 1, department: '', position: '', is_default: false,"
  );
  
  if (content.includes("department: sched.department || '',")) {
      content = content.replace("department: sched.department || '',", "department: sched.department || '',\n            position: sched.position || '',");
  }

  // 5. Update renderScheduleModal to add Position dropdown
  if (!content.includes('label className="form-label">Jabatan')) {
      content = content.replace(
          `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>`,
          `<div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem' }}>`
      );
      content = content.replace(
          `<div className="form-group">
                                <label className="form-label">Departemen</label>
                                <select className="form-input form-select" value={scheduleForm.department}
                                    onChange={e => setScheduleForm(f => ({ ...f, department: e.target.value }))}>
                                    <option value="">Semua Departemen</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>`,
            `<div className="form-group">
                                <label className="form-label">Departemen</label>
                                <select className="form-input form-select" value={scheduleForm.department}
                                    onChange={e => setScheduleForm(f => ({ ...f, department: e.target.value }))}>
                                    <option value="">Semua Departemen</option>
                                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Jabatan (Opsional)</label>
                                <select className="form-input form-select" value={scheduleForm.position}
                                    onChange={e => setScheduleForm(f => ({ ...f, position: e.target.value }))}>
                                    <option value="">Semua Jabatan</option>
                                    {positions.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>`
      );
  }

  // 6. Update card mapping
  if (!content.includes('👔 {sched.position}')) {
      content = content.replace(
          `{sched.department && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>🏢 {sched.department}</span>
                                        )}`,
          `{sched.department && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>🏢 {sched.department}</span>
                                        )}
                                        {sched.position && (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)', marginLeft: '0.5rem' }}>👔 {sched.position}</span>
                                        )}`
      );
  }

  fs.writeFileSync(filePath, content);
  console.log('Update Complete');
}

main();
