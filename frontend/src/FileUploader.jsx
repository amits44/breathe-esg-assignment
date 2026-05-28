/*import { useState } from 'react';

export default function FileUploader({ onUploadSuccess }) {
  const [source, setSource] = useState('utility');
  const [file, setFile] = useState(null);
  const [ekpoFile, setEkpoFile] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    
    if (source === 'sap' && ekpoFile) {
      formData.append('ekpo_file', ekpoFile);
    }

    const endpoint = source === 'sap' 
      ? 'http://localhost:8000/api/v1/upload/sap/' 
      : 'http://localhost:8000/api/v1/upload/utility/';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      
      const data = await res.json();
      setMessage(`Success! Processed ${data.row_count} rows.`);
      setFile(null);
      setEkpoFile(null);
      
      if (onUploadSuccess) onUploadSuccess(); 

    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Ingest New Data</h2>
      
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">Data Source</label>
            <select 
              value={source} 
              onChange={(e) => setSource(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm bg-gray-50"
            >
              <option value="utility">Utility Bills (CSV)</option>
              <option value="sap">SAP Export (EKKO/EKPO CSV)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {source === 'sap' ? 'Primary File (EKKO Header)' : 'Upload CSV'}
            </label>
            <input 
              type="file" 
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full border border-gray-300 rounded p-1.5 text-sm"
              required
            />
          </div>

          {source === 'sap' && (
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Secondary File (EKPO Line Items)</label>
              <input 
                type="file" 
                accept=".csv"
                onChange={(e) => setEkpoFile(e.target.files[0])}
                className="w-full border border-gray-300 rounded p-1.5 text-sm"
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={!file || loading}
            className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : 'Upload'}
          </button>
        </div>

        {message && (
          <p className={`text-sm font-bold ${message.startsWith('') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
  */

import { useState } from 'react';

export default function FileUploader({ onUploadSuccess }) {
  const [source, setSource] = useState('utility');
  const [file, setFile] = useState(null);
  const [ekpoFile, setEkpoFile] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');


  const getFileAccept = () => {
    if (source === 'navan') return '.json';
    return '.csv';
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    
    if (source === 'sap' && ekpoFile) {
      formData.append('ekpo_file', ekpoFile);
    }

    let endpoint;
    if (source === 'sap') {
      endpoint = 'http://localhost:8000/api/v1/upload/sap/';
    } else if (source === 'utility') {
      endpoint = 'http://localhost:8000/api/v1/upload/utility/';
    } else if (source === 'navan') {
      endpoint = 'http://localhost:8000/api/v1/upload/navan/';
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${localStorage.getItem('auth_token')}`,

        },
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
      
      const data = await res.json();
      setMessage(` Success! Processed ${data.row_count} rows.`);
      setFile(null);
      setEkpoFile(null);
      
      // Trigger a refresh of the dashboard table
      if (onUploadSuccess) onUploadSuccess(); 

    } catch (err) {
      setMessage(` Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Ingest New Data</h2>
      
      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">Data Source</label>
            <select 
              value={source} 
              onChange={(e) => {
                setSource(e.target.value);
                setFile(null);
                setEkpoFile(null);
                setMessage('');
              }}
              className="w-full border border-gray-300 rounded p-2 text-sm bg-gray-50"
            >
              <option value="utility">Electricity Usage (CSV)</option>
              <option value="sap">SAP Procurement (EKKO/EKPO CSV)</option>
              <option value="navan">Travel Bookings (Navan JSON)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {source === 'sap' ? 'Primary File (EKKO Header)' : source === 'navan' ? 'Travel Data JSON' : 'Upload CSV'}
            </label>
            <input 
              type="file" 
              accept={getFileAccept()}
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full border border-gray-300 rounded p-1.5 text-sm"
              required
            />
          </div>

          {source === 'sap' && (
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">Secondary File (EKPO Line Items)</label>
              <input 
                type="file" 
                accept=".csv"
                onChange={(e) => setEkpoFile(e.target.files[0])}
                className="w-full border border-gray-300 rounded p-1.5 text-sm"
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={!file || loading}
            className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : 'Upload'}
          </button>
        </div>

        {message && (
          <p className={`text-sm font-bold ${message.startsWith('') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}