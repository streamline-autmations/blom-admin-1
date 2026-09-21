// src/pages/Messages.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/ToastProvider";
import { RefreshCw, MessageSquare } from "lucide-react";
import { useNotifications } from '../contexts/NotificationContext';

export default function Messages() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { markAsRead } = useNotifications();
  const searchTimeoutRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("size", "50");
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const url = `/.netlify/functions/admin-messages?${params}`;
      const r = await fetch(url);

      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }

      const j = await r.json();
      if (j.ok) {
        setRows(j.data || []);
        setTotal(j.total || 0);
        if (j.error) {
          console.warn('Function returned ok but with error:', j.error);
        }
      } else {
        const errMsg = j.error || "Failed to load messages";
        setError(errMsg);
        showToast('error', errMsg);
        console.error('Function error:', j);
      }
    } catch (err) {
      const errMsg = err.message || "Failed to fetch messages";
      setError(errMsg);
      showToast('error', errMsg);
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchInput]);

  useEffect(() => { load(); }, [statusFilter, search, page]);

  const formatDate = (d) => {
    if (!d) return "-";
    const date = new Date(d);
    return date.toLocaleString('en-ZA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };


  // Base44 styling CSS
  const base44Styles = `
    .messages-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px;
    }

    .messages-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .messages-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search-box {
      position: relative;
      width: 280px;
    }

    .search-input {
      width: 100%;
      padding: 12px 16px 12px 44px;
      border-radius: 12px;
      border: none;
      background: var(--card);
      color: var(--text);
      font-size: 14px;
      box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
    }

    .search-input:focus {
      outline: none;
    }

    .search-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }

    .filter-select {
      padding: 12px 16px;
      border-radius: 12px;
      border: none;
      background: var(--card);
      color: var(--text);
      font-size: 14px;
      cursor: pointer;
      box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
      min-width: 160px;
    }

    .btn-primary {
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
      transition: all 0.3s ease;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
    }

    .btn-secondary {
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      background: var(--card);
      color: var(--text);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
      transition: all 0.2s ease;
    }

    .btn-secondary:hover {
      box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
      color: var(--accent);
    }

    .messages-table-card {
      background: var(--card);
      border-radius: 16px;
      padding: 0;
      box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
      overflow: hidden;
    }

    .table-container {
      overflow-x: auto;
    }

    .messages-table {
      width: 100%;
      border-collapse: collapse;
    }

    .messages-table th {
      text-align: left;
      padding: 20px 24px;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid var(--border);
      background: var(--card);
    }

    .messages-table td {
      padding: 20px 24px;
      color: var(--text);
      border-bottom: 1px solid var(--border);
    }

    .messages-table tr:last-child td {
      border-bottom: none;
    }

    .messages-table tbody tr {
      transition: all 0.2s ease;
    }

    .messages-table tbody tr:hover {
      background: rgba(110, 193, 255, 0.05);
      cursor: pointer;
    }

    .messages-badge {
      display: inline-flex;
      padding: 6px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
    }

    .status-new {
      background: #ef444420;
      color: #ef4444;
    }

    .status-handled {
      background: #10b98120;
      color: #10b981;
    }

    .action-btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      background: var(--card);
      color: var(--text);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
      color: var(--accent);
    }

    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: var(--text-muted);
    }

    .empty-state-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 8px;
    }

    .loading-state, .error-state {
      background: var(--card);
      border-radius: 16px;
      padding: 60px;
      text-align: center;
      box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
    }

    .error-state {
      border-left: 4px solid #ef4444;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 24px;
    }

    .pagination-btn {
      padding: 10px 16px;
      border-radius: 10px;
      border: none;
      background: var(--card);
      color: var(--text);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
      transition: all 0.2s ease;
    }

    .pagination-btn:hover:not(:disabled) {
      box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
      color: var(--accent);
    }

    .pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .messages-container {
        padding: 20px;
      }
      .messages-header {
        flex-direction: column;
        align-items: stretch;
      }
      .header-actions {
        justify-content: space-between;
      }
      .search-box {
        width: 100%;
      }
      .messages-table th {
        padding: 16px 12px;
        font-size: 11px;
      }
      .messages-table td {
        padding: 16px 12px;
        font-size: 13px;
      }
    }
  `;

  return (
    <>
      <style>{base44Styles}</style>
      <div className="messages-container">
        {/* Header */}
        <div className="messages-header">
          <h1 className="messages-title">
            <MessageSquare className="w-6 h-6" />
            Messages
          </h1>
          <div className="header-actions">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search by name, email, subject..."
                className="search-input"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <select className="filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Messages</option>
              <option value="new">Unanswered</option>
              <option value="handled">Answered</option>
            </select>
            <button
              onClick={() => markAsRead('messages')}
              className="btn-secondary"
            >
              Mark read
            </button>
            <button
              onClick={() => load()}
              className="btn-secondary"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading-state">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--accent)' }}></div>
            <div style={{ color: 'var(--text-muted)' }}>Loading messages...</div>
          </div>
        )}

        {error && !loading && (
          <div className="error-state">
            <div className="text-red-600 dark:text-red-400 font-semibold mb-2">Error loading messages</div>
            <div className="text-sm text-red-500 dark:text-red-300">{error}</div>
            <button onClick={() => load()} className="btn-secondary mt-4">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="messages-table-card">
            <div className="table-container">
              <table className="messages-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/messages/${r.id}`)}>
                    <td>{r.name || "-"}</td>
                    <td>{r.email || "-"}</td>
                    <td>{r.subject || "(No subject)"}</td>
                    <td>
                      <span className={`messages-badge status-${r.status}`}>
                        {r.status === "new" ? "Unanswered" : "Answered"}
                      </span>
                    </td>
                    <td>{formatDate(r.created_at)}</td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/messages/${r.id}`); }}
                        className="action-btn"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-title">No messages found</div>
                <div className="text-sm">Contact messages will appear here</div>
              </div>
            )}
          </div>
        )}

        {total > 50 && (
          <div className="pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            <span style={{ color: 'var(--text)' }}>
              Page {page} of {Math.ceil(total / 50)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(total / 50)}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
