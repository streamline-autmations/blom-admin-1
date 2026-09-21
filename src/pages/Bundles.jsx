
import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Edit2, Trash2, Search, Package } from "lucide-react";
import { moneyZAR, dateShort } from "../components/formatUtils";
import { useToast } from "../components/ui/ToastProvider";
import { Banner } from "../components/ui/Banner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/components/data/api";

export default function Bundles() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: bundlesData = [], isLoading: isLoadingBundles, error: bundlesError } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => api?.listBundles() || [],
    enabled: !!api,
  });

  // Bundles already include items from listBundles
  const bundles = Array.isArray(bundlesData) ? bundlesData : [];

  const loading = isLoadingBundles;
  const error = bundlesError?.message;

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // Use Netlify function to bypass client write restrictions
      const response = await fetch('/.netlify/functions/delete-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error || 'Failed to delete bundle');
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      queryClient.invalidateQueries({ queryKey: ['bundle-items'] });
      if (result.softDeleted) {
        showToast('success', 'Bundle removed from view (soft deleted due to dependencies)');
      } else {
        showToast('success', 'Bundle deleted successfully');
      }
    },
    onError: (err) => {
      showToast('error', err.message || 'Failed to delete bundle');
    },
  });

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteMutation.mutate(id);
  };

  const getBundleItemsCount = (bundle) => {
    if (typeof bundle.items === 'number') return bundle.items;
    return bundle.items?.length || 0;
  };

  const filteredBundles = bundles.filter(b => {
    if (b.status === 'deleted') return false; // Always exclude deleted
    if (b.name?.startsWith('[DELETED]')) return false; // Always exclude fallback-deleted
    const matchesSearch = b.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <style>{`
        .bundles-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .bundles-title {
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
          width: 240px;
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
          min-width: 140px;
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
          text-decoration: none;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .bundles-table {
          background: var(--card);
          border-radius: 20px;
          padding: 0;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          overflow: hidden;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
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

        td {
          padding: 20px 24px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
        }

        tr:last-child td {
          border-bottom: none;
        }

        tbody tr {
          transition: all 0.2s ease;
        }

        tbody tr:hover {
          background: rgba(110, 193, 255, 0.05);
        }

        .bundle-name {
          font-weight: 600;
        }

        .status-badge {
          display: inline-flex;
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .status-active {
          background: #10b98120;
          color: #10b981;
        }

        .status-draft {
          background: #f59e0b20;
          color: #f59e0b;
        }

        .status-archived {
          background: #6b728020;
          color: #6b7280;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          transition: all 0.2s ease;
        }

        .btn-icon:hover {
          color: var(--accent);
        }

        .btn-icon:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .btn-icon-danger:hover {
          color: #ef4444;
        }

        .price-cell {
          font-weight: 600;
        }

        .compare-price {
          color: var(--text-muted);
          text-decoration: line-through;
          font-size: 13px;
          display: block;
          margin-top: 2px;
        }

        .items-count {
          color: var(--text-muted);
          font-size: 13px;
        }

        .empty-state {
          padding: 80px 20px;
          text-align: center;
          color: var(--text-muted);
        }

        .empty-state-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 8px;
        }
      `}</style>

      {error && <Banner type="error">{error}</Banner>}

      <div className="bundles-header">
        <h1 className="bundles-title">
          <Package className="w-8 h-8" />
          Bundles
        </h1>
        <div className="header-actions">
          <div className="search-box">
            <Search className="search-icon w-5 h-5" />
            <input
              type="text"
              className="search-input"
              placeholder="Search bundles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <Link to={createPageUrl("BundleNew")} className="btn-primary">
            <Plus className="w-5 h-5" />
            New Bundle
          </Link>
        </div>
      </div>

      <div className="bundles-table">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Price</th>
                <th>Items</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading || deleteMutation.isPending ? (
                <tr>
                  <td colSpan="7" className="empty-state">Loading bundles...</td>
                </tr>
              ) : filteredBundles.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    <div className="empty-state-title">No bundles found</div>
                    <div>{searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first bundle to get started'}</div>
                  </td>
                </tr>
              ) : (
                filteredBundles.map(bundle => (
                  <tr key={bundle.id}>
                    <td>
                      <div className="bundle-name">{bundle.name}</div>
                    </td>
                    <td>
                      <span className="status-badge" style={bundle.product_type === 'bundle' ? { background: '#fef3c720', color: '#d97706' } : { background: '#10b98120', color: '#10b981' }}>
                        {bundle.product_type === 'bundle' ? 'Bundle' : 'Collection'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${bundle.status}`}>
                        {bundle.status}
                      </span>
                    </td>
                    <td className="price-cell">
                      {moneyZAR(bundle.price_cents)}
                      {bundle.compare_at_price_cents && (
                        <span className="compare-price">
                          {moneyZAR(bundle.compare_at_price_cents)}
                        </span>
                      )}
                    </td>
                    <td className="items-count">
                      {getBundleItemsCount(bundle)} items
                    </td>
                    <td>{dateShort(bundle.updated_at)}</td>
                    <td>
                      <div className="action-buttons">
                        <Link to={`/bundles/${bundle.id}`}>
                          <button className="btn-icon">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(bundle.id, bundle.name)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
