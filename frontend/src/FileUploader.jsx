import { useState } from 'react';

export default function FileUploader({ onUploadSuccess }) {
  const [source, setSource]     = useState('utility');
  const [file, setFile]         = useState(null);
  const [ekpoFile, setEkpoFile] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null); // {type: 'success'|'error', text}

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    if (source === 'sap' && ekpoFile) formData.append('ekpo_file', ekpoFile);

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const endpoints = {
      sap:     `${API_BASE}/api/v1/upload/sap/`,
      utility: `${API_BASE}/api/v1/upload/utility/`,
      navan:   `${API_BASE}/api/v1/upload/navan/`,
    };

    try {
      const res = await fetch(endpoints[source], {
        method: 'POST',
        headers: { 'Authorization': `Token ${localStorage.getItem('auth_token')}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      const data = await res.json();
      setMessage({
        type: data.error_count > 0 ? 'warn' : 'success',
        text: data.error_count > 0
          ? `Processed ${data.row_count} rows — ${data.error_count} failed. Check server logs.`
          : `✓ Ingested ${data.row_count} rows successfully.`,
      });
      setFile(null);
      setEkpoFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const msgColors = {
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    warn:    { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    error:   { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
  };

  const inputStyle = {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px',
    fontSize: 13, color: '#334155', background: '#fff', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
      padding: '20px 24px', marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>Ingest New Data</h2>

      <form onSubmit={handleUpload}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* Source picker */}
          <div style={{ flex: '0 0 200px' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Data Source
            </label>
            <select
              value={source}
              onChange={e => { setSource(e.target.value); setFile(null); setEkpoFile(null); setMessage(null); }}
              style={inputStyle}
            >
              <option value="utility">Electricity Usage (CSV)</option>
              <option value="sap">SAP Procurement (EKKO/EKPO)</option>
              <option value="navan">Travel Bookings (Navan JSON)</option>
            </select>
          </div>

          {/* Primary file */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {source === 'sap' ? 'EKKO Header File' : source === 'navan' ? 'Navan JSON File' : 'CSV File'}
            </label>
            <input
              type="file"
              accept={source === 'navan' ? '.json' : '.csv'}
              onChange={e => setFile(e.target.files[0])}
              style={inputStyle}
              required
            />
          </div>

          {/* EKPO file — SAP only */}
          {source === 'sap' && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                EKPO Line Items File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={e => setEkpoFile(e.target.files[0])}
                style={inputStyle}
              />
            </div>
          )}

          {/* Upload button */}
          <div>
            <button
              type="submit"
              disabled={!file || loading}
              style={{
                padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                color: '#fff', background: !file || loading ? '#94a3b8' : '#2563eb',
                border: 'none', cursor: !file || loading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap', transition: 'background 0.15s',
              }}
            >
              {loading ? 'Processing…' : 'Upload & Ingest'}
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: msgColors[message.type].bg,
            border: `1px solid ${msgColors[message.type].border}`,
            color: msgColors[message.type].text,
          }}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}