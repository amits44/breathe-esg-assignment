/*import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8000/api/v1';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Token ${localStorage.getItem('auth_token')}`, 
});
const StatusBadge = ({ status }) => {
  const styles = {
    pending:  "bg-blue-100 text-blue-800",
    flagged:  "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
    approved: "bg-green-100 text-green-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.toUpperCase()}
    </span>
  );
};

export default function ReviewDashboard({ refreshTrigger }) {
  const [records, setRecords]       = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/records/`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [refreshTrigger]);

  const handleReview = async (id, action) => {
    try {
      const res = await fetch(`${API}/records/${id}/review/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const updated = await res.json();
      setRecords(records.map(r => r.id === id ? updated : r));
    } catch (err) {
      console.error(`Failed to ${action} record:`, err);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading records...</div>;
  if (error)   return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Analyst Audit Dashboard</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="p-3 text-sm font-semibold text-gray-600">Transaction ID</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Source</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Date</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Vendor</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Amount</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="p-3 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <React.Fragment key={record.id}>
                <tr className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-3 text-sm font-mono text-gray-700">{record.transaction_id}</td>
                  <td className="p-3 text-sm font-medium">{record.source.toUpperCase()}</td>
                  <td className="p-3 text-sm text-gray-600">{record.transaction_date}</td>
                  <td className="p-3 text-sm text-gray-700">{record.vendor_name}</td>
                  <td className="p-3 text-sm text-gray-800 font-medium">{record.amount_display}</td>
                  <td className="p-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                      className="text-sm text-blue-600 hover:underline font-semibold"
                    >
                      {expandedRow === record.id ? 'Hide' : 'Inspect'}
                    </button>
                    {record.status !== 'approved' && (
                      <button
                        onClick={() => handleReview(record.id, 'approve')}
                        className="text-sm px-3 py-1 rounded font-bold text-white bg-green-600 hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {record.status !== 'rejected' && record.status !== 'approved' && (
                      <button
                        onClick={() => handleReview(record.id, 'flag')}
                        className="text-sm px-3 py-1 rounded font-bold text-white bg-yellow-500 hover:bg-yellow-600 transition-colors"
                      >
                        Flag
                      </button>
                    )}
                  </td>
                </tr>

                {expandedRow === record.id && (
                  <tr className="bg-gray-50 border-b">
                    <td colSpan="7" className="p-4">
                      <div className="grid grid-cols-2 gap-4">

                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">System Flags</h4>
                          {record.normalization_warnings?.length > 0 ? (
                            <ul className="list-disc pl-4 text-sm text-orange-700">
                              {record.normalization_warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                          ) : (
                            <p className="text-sm text-green-600 font-semibold">✓ No anomalies detected.</p>
                          )}
                          {record.review_notes && (
                            <div className="mt-2">
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Review Notes</h4>
                              <p className="text-sm text-gray-700">{record.review_notes}</p>
                            </div>
                          )}
                        </div>


                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Source Detail</h4>
                          <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(
                              record.source === 'sap'
                                ? { po_number: record.sap_po_number, cost_center: record.sap_cost_center, company_code: record.sap_company_code }
                                : record.source === 'navan'
                                ? { trip_id: record.navan_trip_id, traveler: record.navan_traveler_name, travel_type: record.navan_travel_type, policy_compliant: record.navan_policy_compliant }
                                : { account: record.utility_account_number, meter: record.utility_meter_id, service: record.utility_service_type },
                              null, 2
                            )}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

*/
import React, { useState, useEffect } from 'react';

const API = 'http://localhost:8000/api/v1';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Token ${localStorage.getItem('auth_token')}`, 
});
const StatusBadge = ({ status }) => {
  const styles = {
    pending:  "bg-blue-100 text-blue-800",
    flagged:  "bg-yellow-100 text-yellow-800",
    rejected: "bg-red-100 text-red-800",
    approved: "bg-green-100 text-green-800",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.toUpperCase()}
    </span>
  );
};

export default function ReviewDashboard({ refreshTrigger }) {
  const [records, setRecords]       = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/records/`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, [refreshTrigger]);

  const handleReview = async (id, action) => {
    try {
      const res = await fetch(`${API}/records/${id}/review/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const updated = await res.json();
      setRecords(records.map(r => r.id === id ? updated : r));
    } catch (err) {
      console.error(`Failed to ${action} record:`, err);
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Loading records...</div>;
  if (error)   return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Analyst Audit Dashboard</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="p-3 text-sm font-semibold text-gray-600">Transaction ID</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Source</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Date</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Vendor</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Amount</th>
              <th className="p-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="p-3 text-sm font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <React.Fragment key={record.id}>
                <tr className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-3 text-sm font-mono text-gray-700">{record.transaction_id}</td>
                  <td className="p-3 text-sm font-medium">{record.source.toUpperCase()}</td>
                  <td className="p-3 text-sm text-gray-600">{record.transaction_date}</td>
                  <td className="p-3 text-sm text-gray-700">{record.vendor_name}</td>
                  <td className="p-3 text-sm text-gray-800 font-medium">{record.amount_display}</td>
                  <td className="p-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                      className="text-sm text-blue-600 hover:underline font-semibold"
                    >
                      {expandedRow === record.id ? 'Hide' : 'Inspect'}
                    </button>
                    {record.status !== 'approved' && (
                      <button
                        onClick={() => handleReview(record.id, 'approve')}
                        className="text-sm px-3 py-1 rounded font-bold text-white bg-green-600 hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                    )}
                    {record.status !== 'rejected' && record.status !== 'approved' && (
                      <button
                        onClick={() => handleReview(record.id, 'flag')}
                        className="text-sm px-3 py-1 rounded font-bold text-white bg-yellow-500 hover:bg-yellow-600 transition-colors"
                      >
                        Flag
                      </button>
                    )}
                  </td>
                </tr>

                {expandedRow === record.id && (
                  <tr className="bg-gray-50 border-b">
                    <td colSpan="7" className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Warnings panel */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">System Flags</h4>
                          {record.normalization_warnings?.length > 0 ? (
                            <ul className="list-disc pl-4 text-sm text-orange-700">
                              {record.normalization_warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                          ) : (
                            <p className="text-sm text-green-600 font-semibold">✓ No anomalies detected.</p>
                          )}
                          {record.review_notes && (
                            <div className="mt-2">
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Review Notes</h4>
                              <p className="text-sm text-gray-700">{record.review_notes}</p>
                            </div>
                          )}
                        </div>

                        {/* Source-specific detail */}
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Source Detail</h4>
                          <pre className="bg-gray-800 text-green-400 p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(
                              record.source === 'sap'
                                ? { po_number: record.sap_po_number, cost_center: record.sap_cost_center, company_code: record.sap_company_code }
                                : record.source === 'navan'
                                ? { 
                                    booking_id: record.navan_booking_id,
                                    traveler: record.navan_traveler_name,
                                    travel_type: record.navan_travel_type,
                                    origin: record.navan_origin,
                                    destination: record.navan_destination,
                                    distance_km: record.navan_distance_km,
                                    cabin_class: record.navan_cabin_class,
                                    policy_compliant: record.navan_policy_compliant
                                  }
                                : { 
                                    account: record.utility_account_number, 
                                    meter: record.utility_meter_id, 
                                    service: record.utility_service_type,
                                    kwh_usage: record.utility_kwh_usage
                                  },
                              null, 2
                            )}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}