import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Check } from "lucide-react";
import { moneyZAR } from "../components/formatUtils";
import { useToast } from "../components/ui/ToastProvider";
import { api } from "@/components/data/api";

export default function PriceUpdates() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [adjustmentType, setAdjustmentType] = useState("percent");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [reason, setReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: productsData = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api?.listProducts() || [],
    enabled: !!api,
  });

  // Ensure products is always an array
  const products = Array.isArray(productsData) ? productsData : [];

  // New state for cost price updates
  const [showCostPriceSection, setShowCostPriceSection] = useState(false);
  const [costPriceAdjustmentType, setCostPriceAdjustmentType] = useState("percent");
  const [costPriceAdjustmentValue, setCostPriceAdjustmentValue] = useState("");

  const updateMutation = useMutation({
    mutationFn: async ({ updates, isCostPrice = false }) => {
      if (!api) throw new Error('API not available');
      await Promise.all(
        updates.map(({ id, newPrice }) => {
          if (isCostPrice) {
            return api.partialUpdateProduct({ id, cost_price_cents: newPrice });
          } else {
            return api.partialUpdateProduct({ id, price_cents: newPrice });
          }
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('success', `Updated ${selectedIds.length} products`);
      setSelectedIds([]);
      setAdjustmentValue("");
      setCostPriceAdjustmentValue("");
      setReason("");
      setShowConfirm(false);
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to update prices');
    },
  });

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const togglePriceType = () => {
    setShowCostPriceSection(!showCostPriceSection);
    setSelectedIds([]);
    if (showCostPriceSection) {
      setCostPriceAdjustmentValue("");
    } else {
      setAdjustmentValue("");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getPriceTypeLabel = () => {
    return showCostPriceSection ? "Cost Price" : "Selling Price";
  };

  const calculateNewPrice = (oldPrice, isCostPrice = false) => {
    const val = parseFloat(isCostPrice ? costPriceAdjustmentValue : adjustmentValue) || 0;
    const type = isCostPrice ? costPriceAdjustmentType : adjustmentType;
    
    if (type === "percent") {
      return Math.max(1, Math.round(oldPrice * (1 + val / 100)));
    }
    if (type === "increase") {
      return Math.max(1, oldPrice + Math.round(val * 100));
    }
    if (type === "decrease") {
      return Math.max(1, oldPrice - Math.round(val * 100));
    }
    if (type === "set") {
      return Math.max(1, Math.round(val * 100));
    }
    return oldPrice;
  };

  const selectedProducts = products.filter(p => selectedIds.includes(p.id));
  const updates = selectedProducts.map(p => {
    const price = p.price_cents || p.price || 0;
    const costPrice = p.cost_price_cents || p.cost_price || 0;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      stock: p.stock_qty || p.stock || 0,
      oldPrice: price,
      newPrice: calculateNewPrice(price),
      oldCostPrice: costPrice,
      newCostPrice: calculateNewPrice(costPrice, true)
    };
  });

  const handleApply = () => {
    if (selectedIds.length === 0) {
      showToast('error', 'No products selected');
      return;
    }
    if (!adjustmentValue && !showCostPriceSection) {
      showToast('error', 'Enter adjustment value');
      return;
    }
    if (showCostPriceSection && !costPriceAdjustmentValue) {
      showToast('error', 'Enter cost price adjustment value');
      return;
    }
    setShowConfirm(true);
  };

  const confirmUpdate = () => {
    updateMutation.mutate({ updates, isCostPrice: showCostPriceSection });
  };

  return (
    <>
      <style>{`
        .price-updates-header {
          margin-bottom: 32px;
        }

        .header-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .header-subtitle {
          color: var(--text-muted);
          font-size: 14px;
        }

        .price-type-toggle {
          display: inline-flex;
          gap: 8px;
          background: var(--bg);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 24px;
        }

        .price-type-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .price-type-btn.active {
          background: var(--card);
          color: var(--text);
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .controls-panel {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr auto;
          gap: 16px;
          align-items: end;
        }

        .search-select-panel {
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-input {
          flex: 1;
          min-width: 250px;
          padding: 12px 16px;
          border-radius: 10px;
          border: none;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .search-input:focus {
          outline: none;
        }

        .btn-select-all {
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          display: flex;
          align-items: center;
          gap: 8px;
          height: fit-content;
        }

        .btn-select-all:hover {
          transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .controls-grid {
            grid-template-columns: 1fr;
          }
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .control-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .control-select, .control-input {
          padding: 12px 16px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .control-input:focus, .control-select:focus {
          outline: none;
        }

        .btn-apply {
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          display: flex;
          align-items: center;
          gap: 8px;
          height: fit-content;
        }

        .btn-apply:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-apply:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .products-table {
          background: var(--card);
          border-radius: 16px;
          padding: 0;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          overflow: hidden;
        }

        .table-header {
          padding: 20px 24px;
          border-bottom: 2px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .table-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }

        .selected-count {
          font-size: 14px;
          color: var(--text-muted);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 16px 24px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--card);
          border-bottom: 1px solid var(--border);
        }

        td {
          padding: 16px 24px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
        }

        tr:last-child td {
          border-bottom: none;
        }

        tbody tr:hover {
          background: rgba(110, 193, 255, 0.05);
        }

        .checkbox-cell {
          width: 40px;
        }

        .checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .product-name {
          font-weight: 600;
        }

        .price-cell {
          font-weight: 600;
        }

        .price-diff {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .price-arrow {
          color: var(--text-muted);
        }

        .price-new {
          color: var(--accent);
          font-weight: 700;
        }

        .price-increase {
          color: #10b981;
        }

        .price-decrease {
          color: #ef4444;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--card);
          border-radius: 16px;
          padding: 32px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }

        .modal-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 20px;
        }

        .modal-summary {
          background: var(--bg);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-cancel {
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .btn-cancel:hover {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .btn-confirm {
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }
      `}</style>

      <div className="price-updates-header">
        <h1 className="header-title">Bulk Price Updates</h1>
        <p className="header-subtitle">Select products and apply {getPriceTypeLabel().toLowerCase()} pricing adjustments</p>
        
        <div className="price-type-toggle">
          <button
            className={`price-type-btn ${!showCostPriceSection ? 'active' : ''}`}
            onClick={togglePriceType}
          >
            Selling Price
          </button>
          <button
            className={`price-type-btn ${showCostPriceSection ? 'active' : ''}`}
            onClick={togglePriceType}
          >
            Cost Price
          </button>
        </div>
      </div>

      <div className="search-select-panel">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Search products by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        
        <button
          className="btn-select-all"
          onClick={() => {
            if (selectedIds.length === filteredProducts.length) {
              setSelectedIds([]);
            } else {
              setSelectedIds(filteredProducts.map(p => p.id));
            }
          }}
        >
          {selectedIds.length === filteredProducts.length && filteredProducts.length > 0
            ? 'Deselect All'
            : 'Select All'}
        </button>
      </div>

      <div className="controls-panel">
        <div className="controls-grid">
          <div className="control-group">
            <label className="control-label">Adjustment Type</label>
            <select
              className="control-select"
              value={showCostPriceSection ? costPriceAdjustmentType : adjustmentType}
              onChange={(e) => {
                if (showCostPriceSection) {
                  setCostPriceAdjustmentType(e.target.value);
                } else {
                  setAdjustmentType(e.target.value);
                }
              }}
            >
              <option value="percent">Percentage</option>
              <option value="increase">Increase by R</option>
              <option value="decrease">Decrease by R</option>
              <option value="set">Set exact price</option>
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">Value</label>
            <input
              type="number"
              className="control-input"
              value={showCostPriceSection ? costPriceAdjustmentValue : adjustmentValue}
              onChange={(e) => {
                if (showCostPriceSection) {
                  setCostPriceAdjustmentValue(e.target.value);
                } else {
                  setAdjustmentValue(e.target.value);
                }
              }}
              placeholder={showCostPriceSection ? (costPriceAdjustmentType === "percent" ? "10" : "5.00") : (adjustmentType === "percent" ? "10" : "5.00")}
              step="0.01"
            />
          </div>

          <div className="control-group">
            <label className="control-label">Reason (optional)</label>
            <input
              type="text"
              className="control-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Seasonal promotion"
            />
          </div>

          <button
            className="btn-apply"
            onClick={handleApply}
            disabled={selectedIds.length === 0 ||
                     (showCostPriceSection ? !costPriceAdjustmentValue : !adjustmentValue) ||
                     updateMutation.isPending}
          >
            <Check className="w-5 h-5" />
            Apply
          </button>
        </div>
      </div>

      <div className="products-table">
        <div className="table-header">
          <div className="table-title">Products</div>
          <div className="selected-count">
            {selectedIds.length} of {filteredProducts.length} selected
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th className="checkbox-cell">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(filteredProducts.map(p => p.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </th>
              <th>Product</th>
              <th>{getPriceTypeLabel()} Price</th>
              <th>Compare At</th>
              {(showCostPriceSection ? costPriceAdjustmentValue : adjustmentValue) && <th>New {getPriceTypeLabel()}</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading products...
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No products found
                </td>
              </tr>
            ) : (
              filteredProducts.map(product => {
                const productPrice = showCostPriceSection
                  ? (product.cost_price_cents || product.cost_price || 0)
                  : (product.price_cents || product.price || 0);
                const isSelected = selectedIds.includes(product.id);
                const newPrice = isSelected && (showCostPriceSection ? costPriceAdjustmentValue : adjustmentValue)
                  ? calculateNewPrice(productPrice, showCostPriceSection)
                  : null;
                const priceChange = newPrice ? newPrice - productPrice : 0;

                return (
                  <tr key={product.id}>
                    <td className="checkbox-cell">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(product.id)}
                      />
                    </td>
                    <td>
                      <div className="product-name">{product.name}</div>
                    </td>
                    <td className="price-cell">
                      {showCostPriceSection
                        ? moneyZAR(product.cost_price_cents || product.cost_price || 0)
                        : moneyZAR(product.price_cents || product.price || 0)}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {product.compare_at_price_cents || product.compare_at_price ? moneyZAR(product.compare_at_price_cents || product.compare_at_price || 0) : '—'}
                    </td>
                    {(showCostPriceSection ? costPriceAdjustmentValue : adjustmentValue) && (
                      <td>
                        {isSelected && newPrice ? (
                          <div className="price-diff">
                            <span className="price-new">{moneyZAR(newPrice)}</span>
                            {priceChange !== 0 && (
                              <span className={priceChange > 0 ? 'price-increase' : 'price-decrease'}>
                                {priceChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Confirm Price Update</h2>
            
            <div className="modal-summary">
              <div className="summary-item">
                <span>Products to update:</span>
                <strong>{updates.length}</strong>
              </div>
              <div className="summary-item">
                <span>Price type:</span>
                <strong>{getPriceTypeLabel()}</strong>
              </div>
              <div className="summary-item">
                <span>Adjustment type:</span>
                <strong>{showCostPriceSection ? costPriceAdjustmentType : adjustmentType}</strong>
              </div>
              <div className="summary-item">
                <span>Value:</span>
                <strong>{showCostPriceSection ? costPriceAdjustmentValue : adjustmentValue}</strong>
              </div>
              {reason && (
                <div className="summary-item">
                  <span>Reason:</span>
                  <strong>{reason}</strong>
                </div>
              )}
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
              {updates.map(update => (
                <div key={update.id} className="summary-item">
                  <span>{update.name}</span>
                  <span>
                    {showCostPriceSection
                      ? `${moneyZAR(update.oldCostPrice)} → <strong>${moneyZAR(update.newCostPrice)}</strong>`
                      : `${moneyZAR(update.oldPrice)} → <strong>${moneyZAR(update.newPrice)}</strong>`}
                  </span>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={confirmUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}