export default function ApprovalTimeline({ steps = [], currentStep, status }) {
    if (!steps.length) {
        return (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                Approval satu tingkat (legacy)
            </p>
        );
    }

    function stepStyle(step) {
        if (step.status === 'approved') {
            return { bg: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.45)', color: '#86efac' };
        }
        if (step.status === 'rejected') {
            return { bg: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.45)', color: '#fca5a5' };
        }
        if (step.status === 'pending' || (status === 'pending' && step.step_order === currentStep)) {
            return { bg: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.5)', color: '#fcd34d' };
        }
        return { bg: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--gray-400)' };
    }

    const icon = {
        approved: '✅',
        rejected: '❌',
        pending: '⏳',
        waiting: '○',
        skipped: '↷'
    };

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'stretch', marginTop: '0.75rem' }}>
            {steps.map((step, index) => {
                const s = stepStyle(step);
                return (
                    <div key={step.id || index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                            padding: '0.45rem 0.7rem',
                            borderRadius: 'var(--radius)',
                            background: s.bg,
                            border: s.border,
                            minWidth: 140
                        }}>
                            <div style={{ fontSize: '0.72rem', color: s.color, fontWeight: 700 }}>
                                {icon[step.status] || '○'} Tingkat {step.step_order}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'white', fontWeight: 600, marginTop: 2 }}>
                                {step.approver_name || step.approver_label || 'Admin / HR'}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                                {step.approver_label}
                                {step.status === 'skipped' ? ' • dilewati' : ''}
                            </div>
                            {step.notes && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 4 }}>
                                    “{step.notes}”
                                </div>
                            )}
                        </div>
                        {index < steps.length - 1 && (
                            <span style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>→</span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
