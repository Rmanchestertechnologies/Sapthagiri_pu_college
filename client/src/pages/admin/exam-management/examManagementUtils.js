export const EXAM_TYPES = ['JEE', 'NEET', 'CET'];

export const STATUS_COLORS = {
    draft: '#6b7280',
    scheduled: '#f59e0b',
    live: '#10b981',
    ended: '#ef4444'
};

export const getOptionsGridStyle = (options) => {
    if (!options || options.length === 0) {
        return {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '8px 24px',
            marginTop: '8px',
            marginLeft: '24px',
            fontSize: '0.95em'
        };
    }
    
    let hasComplexFormula = false;
    const cleanLengths = options.map(opt => {
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || '') : (opt || ''));
        const clean = str.replace(/<[^>]+>/g, '').trim();
        if (/(\$|\\\[|\\\(|\\frac|\\sqrt|\\int|\\rightarrow|\||\^|_)/i.test(clean)) {
            if (clean.length > 12 || clean.includes('|') || clean.includes('\\rightarrow') || clean.includes('\\frac')) {
                hasComplexFormula = true;
            }
        }
        return clean.length;
    });

    if (hasComplexFormula) {
        return {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '8px 24px',
            marginTop: '8px',
            marginLeft: '24px',
            fontSize: '0.95em'
        };
    }
    
    const maxLength = Math.max(...cleanLengths);
    const totalLength = cleanLengths.reduce((a, b) => a + b, 0);
    
    let columns = '1fr';
    let gap = '10px 24px';
    
    if (maxLength <= 10 && totalLength <= 40) {
        columns = '1fr 1fr 1fr 1fr';
        gap = '8px 16px';
    } else if (maxLength <= 28 && totalLength <= 90) {
        columns = '1fr 1fr';
        gap = '8px 24px';
    }
    
    return {
        display: 'grid',
        gridTemplateColumns: columns,
        gap: gap,
        marginTop: '8px',
        marginLeft: '24px',
        fontSize: '0.95em'
    };
};

export const localToUtcIso = (localStr) => {
    if (!localStr) return null;
    const d = new Date(localStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
};

export const utcToLocalStr = (utcStr) => {
    if (!utcStr) return '';
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Helper to auto-calculate end time based on start time and duration
export const calculateEndTime = (startTimeStr, durationMin) => {
    if (!startTimeStr || !durationMin) return '';
    const start = new Date(startTimeStr);
    if (isNaN(start.getTime())) return '';
    const end = new Date(start.getTime() + durationMin * 60 * 1000);
    
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = end.getFullYear();
    const mm = pad(end.getMonth() + 1);
    const dd = pad(end.getDate());
    const hh = pad(end.getHours());
    const min = pad(end.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};
