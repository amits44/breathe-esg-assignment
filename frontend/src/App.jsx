import React, { useState } from 'react';

export default function UploadUI({ onUploadSuccess }) {
  const [source, setSource] = useState('SAP');
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a file first.");

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', source);

    try {
      // Assuming your Django API runs on localhost:8000
      const response = await fetch(`http://localhost:8000/api/ingest/${source.toLowerCase()}/`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert("Data successfully ingested and sent to the parsing pipeline.");
        setFile(null);
        onUploadSuccess(); // Trigger dashboard refresh
      } else {
        alert("Ingestion failed. Check API logs.");
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md mb-8 border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Manual Data Ingestion</h2>
      <form onSubmit={handleUpload} className="flex items-end gap-4">
        <div className="flex flex-col">
          <label className="text-sm font-semibold text-gray-600 mb-1">Data Source</label>
          <select 
            value={source} 
            onChange={(e) => setSource(e.target.value)}
            className="border p-2 rounded-md bg-gray-50 focus:ring-2 focus:ring-blue-500"
          >
            <option value="SAP">SAP ERP (CSV)</option>
            <option value="UTILITY">Utility Portal (CSV)</option>
            <option value="CONCUR">Corporate Travel (JSON)</option>
          </select>
        </div>
        
        <div className="flex flex-col flex-grow">
          <label className="text-sm font-semibold text-gray-600 mb-1">Select File</label>
          <input 
            type="file" 
            onChange={handleFileChange}
            accept=".csv,.json"
            className="border p-2 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <button 
          type="submit" 
          disabled={isUploading}
          className="bg-blue-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isUploading ? 'Ingesting...' : 'Run Pipeline'}
        </button>
      </form>
    </div>
  );
}