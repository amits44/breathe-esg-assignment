import React, { useState, useEffect } from 'react';

const API = '${import.meta.env.VITE_API_URL}/api/v1';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Token ${localStorage.getItem('auth_token')}`,
});

// ── Scope config ──────────────────────────────────────────────────────────────
const SCOPE = {
  1: { label: 'Scope 1', sub: 'Direct Emissions',       color: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
  2: { label: 'Scope 2', sub: 'Purchased Energy',       color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  3: { label: 'Scope 3', sub: 'Value Chain',            color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
};

const STATUS = {
  pending:  { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
  flagged:  { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b' },
  approved: { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
  rejected: { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
};

const SOURCE = {
  sap:     { label: 'SAP',     bg: '#f5f3ff', text: '#6d28d9' },
  utility: { label: 'Utility', bg: '#ecfeff', text: '#0e7490' },
  navan:   { label: 'Navan',   bg: '#eef2ff', text: '#4338ca' },
};

// ── Small components ──────────────────────────────────────────────────────────

const Pill = ({ label, bg, text }) => (
  <span style={{ background: bg, color: text, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
    {label}
  </span>
);

const ScopePill = ({ scope }) => {
  if (!scope) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>;
  const s = SCOPE[scope];
  return (
    <span style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {s.label}
    </span>
  );
};

const StatusPill = ({ status }) => {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span style={{ background: s.bg, color: s.text, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ── Summary cards ─────────────────────────────────────────────────────────────

const card = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '18px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

function StatCard({ label, value, sub, valueColor }) {
  return (
    <div style={card}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: valueColor || '#1e293b', lineHeight: 1.2 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function ScopeCard({ scope, data }) {
  const s = SCOPE[scope];
  const co2e = parseFloat(data?.co2e_kg || 0).toFixed(1);
  const count = data?.count || 0;
  return (
    <div style={{ ...card, borderTop: `3px solid ${s.color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: s.text }}>{s.label}</p>
          <p style={{ fontSize: 11, color: '#94a3b8' }}>{s.sub}</p>
        </div>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, marginTop: 2, display: 'inline-block' }} />
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>
        {co2e} <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>kgCO₂e</span>
      </p>
      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{count} record{count !== 1 ? 's' : ''}</p>
    </div>
  );
}

// ── Expanded detail panel ─────────────────────────────────────────────────────

function DetailPanel({ record }) {
  const sourceFields =
  record.source === 'sap'
    ? [
        ['PO Number',    record.sap_po_number],
        ['Cost Center',  record.sap_cost_center],
        ['Company Code', record.sap_company_code],
        ['GL Account',   record.sap_gl_account],
      ]
    : record.source === 'navan' && record.navan_travel_type === 'hotel'
    ? [
        ['Trip ID',          record.navan_trip_id],
        ['Traveler',         record.navan_traveler_name],
        ['Check-in',         record.navan_departure_date],
        ['Check-out',        record.navan_return_date],
        ['Location',         record.navan_destination],
        ['Policy Compliant', record.navan_policy_compliant == null ? '—' : record.navan_policy_compliant ? '✓ Yes' : '✗ No'],
        ['Out-of-Policy',    record.navan_out_of_policy_reason || '—'],
      ]
    : record.source === 'navan'
    ? [
        ['Trip ID',          record.navan_trip_id],
        ['Traveler',         record.navan_traveler_name],
        ['Travel Type',      record.navan_travel_type],
        ['Route',            `${record.navan_origin || '?'} → ${record.navan_destination || '?'}`],
        ['Departure',        record.navan_departure_date],
        ['Return',           record.navan_return_date],
        ['Policy Compliant', record.navan_policy_compliant == null ? '—' : record.navan_policy_compliant ? '✓ Yes' : '✗ No'],
        ['Out-of-Policy',    record.navan_out_of_policy_reason || '—'],
      ]
    : [
        ['Account No',   record.utility_account_number],
        ['Meter ID',     record.utility_meter_id],
        ['Service Type', record.utility_service_type],
        ['Usage (kWh)',  record.utility_usage_kwh || '—'],
      ];
  const panelStyle = {
    background: '#f8fafc',
    borderTop: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
  };

  const sectionTitle = {
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 10,
  };

  const dlRow = { display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 8 };
  const dt = { fontSize: 12, color: '#94a3b8' };
  const dd = { fontSize: 12, color: '#334155', fontWeight: 600, textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  const co2e = parseFloat(record.co2e_kg || 0);

  return (
    <div style={panelStyle}>
      {/* Source detail */}
      <div>
        <p style={sectionTitle}>Source Detail</p>
        {sourceFields.map(([k, v]) => (
          <div key={k} style={dlRow}>
            <span style={dt}>{k}</span>
            <span style={dd} title={v}>{v || '—'}</span>
          </div>
        ))}
      </div>

      {/* Emissions */}
      <div>
        <p style={sectionTitle}>Emissions</p>
        <div style={dlRow}>
          <span style={dt}>GHG Scope</span>
          <ScopePill scope={record.emission_scope} />
        </div>
        <div style={dlRow}>
          <span style={dt}>CO₂e</span>
          <span style={{ ...dd, color: co2e > 0 ? '#059669' : '#94a3b8' }}>
            {co2e > 0 ? `${co2e.toFixed(2)} kg` : '—'}
          </span>
        </div>
        {record.emission_scope === 1 && (
          <div style={{ marginTop: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#b91c1c' }}>
            ⚠ Direct emission — verify fuel consumption data
          </div>
        )}
        {record.emission_scope === 2 && (
          <div style={{ marginTop: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#92400e' }}>
            ⚡ Purchased energy — check grid emission factor
          </div>
        )}
      </div>

      {/* Flags */}
      <div>
        <p style={sectionTitle}>System Flags</p>
        {record.normalization_warnings?.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {record.normalization_warnings.map((w, i) => (
              <li key={i} style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 8px', marginBottom: 4 }}>
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✓ No anomalies detected</p>
        )}
        {record.review_notes && (
          <div style={{ marginTop: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#475569' }}>
            <strong style={{ color: '#94a3b8', display: 'block', marginBottom: 2 }}>Review Notes</strong>
            {record.review_notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function ReviewDashboard({ refreshTrigger }) {
  const [records, setRecords]         = useState([]);
  const [summary, setSummary]         = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [filters, setFilters]         = useState({ source: '', status: '', scope: '' });

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.source) params.set('source', filters.source);
      if (filters.status) params.set('status', filters.status);

      const [recRes, sumRes] = await Promise.all([
        fetch(`${API}/records/?${params}`, { headers: authHeaders() }),
        fetch(`${API}/summary/`, { headers: authHeaders() }),
      ]);
      if (!recRes.ok) throw new Error(`${recRes.status} ${recRes.statusText}`);
      if (!sumRes.ok) throw new Error(`Summary: ${sumRes.status}`);

      const recData = await recRes.json();
      const sumData = await sumRes.json();
      let recs = Array.isArray(recData) ? recData : recData.results ?? [];
      if (filters.scope) recs = recs.filter(r => String(r.emission_scope) === filters.scope);
      setRecords(recs);
      setSummary(sumData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [refreshTrigger, filters.source, filters.status, filters.scope]);

  const handleReview = async (id, action) => {
    try {
      const res = await fetch(`${API}/records/${id}/review/`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const updated = await res.json();
      setRecords(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err) { console.error(err); }
  };

  const totalCO2e = records.reduce((s, r) => s + parseFloat(r.co2e_kg || 0), 0);
  const pending   = records.filter(r => r.status === 'pending').length;

  const sel = {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px',
    fontSize: 13, background: '#fff', color: '#334155', cursor: 'pointer',
  };

  if (error) return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 24, color: '#991b1b', fontSize: 14 }}>
      <strong>Error:</strong> {error}
    </div>
  );

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Total Records" value={records.length} sub={`${pending} pending review`} />
        <StatCard label="Total CO₂e" value={`${totalCO2e.toFixed(1)} kg`} sub="estimated" valueColor="#059669" />
        {[1, 2, 3].map(s => <ScopeCard key={s} scope={s} data={summary?.scope_totals?.[`scope_${s}`]} />)}
      </div>

      {/* Table card */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Transaction Review Queue</h2>
          {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Refreshing…</span>}
        </div>

        {/* Filters */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={sel} value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}>
            <option value="">All Sources</option>
            <option value="sap">SAP</option>
            <option value="utility">Utility</option>
            <option value="navan">Navan</option>
          </select>
          <select style={sel} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select style={sel} value={filters.scope} onChange={e => setFilters(f => ({ ...f, scope: e.target.value }))}>
            <option value="">All Scopes</option>
            <option value="1">Scope 1 — Direct</option>
            <option value="2">Scope 2 — Energy</option>
            <option value="3">Scope 3 — Value Chain</option>
          </select>
          {(filters.source || filters.status || filters.scope) && (
            <button onClick={() => setFilters({ source: '', status: '', scope: '' })}
              style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Transaction ID', 'Source', 'Date', 'Vendor', 'Amount', 'Scope', 'CO₂e', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: h === '' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && !loading && (
                <tr><td colSpan="9" style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  No records found. Upload data using the form above.
                </td></tr>
              )}
              {records.map(r => {
                const isOpen = expandedRow === r.id;
                const src = SOURCE[r.source] || { label: r.source?.toUpperCase(), bg: '#f1f5f9', text: '#475569' };
                const co2e = parseFloat(r.co2e_kg || 0);
                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedRow(isOpen ? null : r.id)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff', transition: 'background 0.15s' }}
                      onMouseEnter={e => !isOpen && (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => !isOpen && (e.currentTarget.style.background = '#fff')}
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{r.transaction_id || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><Pill label={src.label} bg={src.bg} text={src.text} /></td>
                      <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{r.transaction_date || '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#1e293b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.vendor_name}</td>
                      <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.amount_display}</td>
                      <td style={{ padding: '12px 16px' }}><ScopePill scope={r.emission_scope} /></td>
                      <td style={{ padding: '12px 16px', color: co2e > 0 ? '#059669' : '#cbd5e1', fontWeight: co2e > 0 ? 600 : 400, fontSize: 12 }}>
                        {co2e > 0 ? `${co2e.toFixed(1)} kg` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}><StatusPill status={r.status} /></td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {r.status !== 'approved' && (
                            <button onClick={() => handleReview(r.id, 'approve')}
                              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#fff', background: '#16a34a', border: 'none', cursor: 'pointer' }}>
                              Approve
                            </button>
                          )}
                          {r.status !== 'rejected' && r.status !== 'approved' && (
                            <button onClick={() => handleReview(r.id, 'flag')}
                              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef9c3', border: 'none', cursor: 'pointer' }}>
                              Flag
                            </button>
                          )}
                          {r.status === 'approved' && (
                            <button onClick={() => handleReview(r.id, 'reject')}
                              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: 'none', cursor: 'pointer' }}>
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan="9" style={{ padding: 0 }}>
                          <DetailPanel record={r} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}