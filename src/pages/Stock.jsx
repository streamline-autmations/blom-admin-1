import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { History, Search, Save, X } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';
import { api } from '../components/data/api';

// Helper to format currency
const formatRands = (cents) => {
  if (cents == null || isNaN(cents)) return 'R0.00';
  return `R${(cents / 100).toFixed(2)}`;
};

// Helper to determine stock type
const getStockType = (product) => {
  if (product.stock_type) return product.stock_type;

  const category = (product.category || '').toLowerCase();
  if (category.includes('course') || category.includes('workshop') || category.includes('training')) {
    return 'unlimited';
  }
  if (category.includes('furniture')) {
    return 'made_on_demand';
  }
  return 'tracked';
};

export default function Stock() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();

  // Fetch product variants with parent product information
  const { data: variantsResponse, isLoading } = useQuery({
    queryKey: ['product_variants_with_products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select(`
          id,
          name as variant_name,
          stock_quantity,
          cost_price_cents,
          status,
          product_id,
          products (id, name, status, category)
        `)
        .eq('products.status', 'active');
      
      if (error) {
        console.error('Error fetching product variants:', error);
        return [];
      }
      
      return data || [];
    },
  });

  // Transform the response to match Stock page expectations
  const variants = variantsResponse?.map(variant => ({
    id: variant.id,
    name: variant.variant_name || 'Default',
    parent_product_name: variant.products?.name || 'Unknown',
    parent_product_id: variant.product_id,
    stock_quantity: variant.stock_quantity || 0,
    cost_price_cents: variant.cost_price_cents || 0,
    status: variant.status || 'active',
    category: variant.products?.category || '',
    stock_type: getStockType(variant.products || {})
  })) || [];

  // Helper function to get variant stock level

  // Filter logic: Hide furniture/courses/unlimited items, only show active variants, apply search
  const filteredVariants = useMemo(() => {
    if (!variants) return [];
    return variants.filter(variant => {
      // Only show active variants
      if (variant.status !== 'active') return false;

      const cat = (variant.category || '').toLowerCase();
      const stockType = getStockType(variant);
      
      // Exclude items that don't need stock tracking
      if (cat.includes('furniture') ||
          cat.includes('course') ||
          cat.includes('workshop') ||
          cat.includes('training') ||
          stockType === 'unlimited' ||
          stockType === 'made_on_demand') {
        return false;
      }

      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return variant.parent_product_name?.toLowerCase().includes(term) ||
               variant.name?.toLowerCase().includes(term);
      }
      return true;
    });
  }, [variants, searchTerm]);

  const handleOpenAdjust = (product) => {
    setSelectedProduct(product);
    setShowAdjustModal(true);
  };

  return (
    <>
      <style>{`
        .stock-header {
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

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 16px;
        }

        .search-box {
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
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

        .section-card {
          background: var(--card);
          border-radius: 16px;
          padding: 0;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          overflow: hidden;
          margin-bottom: 24px;
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

        .btn-secondary {
          padding: 8px 16px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .btn-primary {
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
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Modal Styling */
        .input, .select {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          outline: none;
          position: relative;
          z-index: 1;
        }
        
        .input:focus, .select:focus {
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light), 0 0 0 2px var(--accent);
        }

        .input:focus, .select:focus {
          outline: none;
        }

        @media (max-width: 768px) {
          .header-actions {
            flex-direction: column;
            width: 100%;
          }

          .search-box {
            max-width: 100%;
          }
        }
      `}</style>

      <div className="p-4 md:p-8">
        <div className="stock-header">
          <h1 className="header-title">Stock Management</h1>
          <p className="header-subtitle">Track inventory levels and product costs.</p>

          <div className="header-actions">
            <div className="search-box">
              <Search className="search-icon w-5 h-5" />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        {showAdjustModal && (
          <AdjustStockModal
            product={selectedProduct}
            onClose={() => {
              setShowAdjustModal(false);
              setSelectedProduct(null);
            }}
            showToast={showToast}
          />
        )}

        <div className="section-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <th className="p-4">Product</th>
                  <th className="p-4">Cost Price</th>
                  <th className="p-4">Stock Level</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" className="p-8 text-center text-[var(--text-muted)]">Loading inventory...</td></tr>
                ) : filteredVariants.length === 0 ? (
                  <tr><td colSpan="5" className="p-8 text-center text-[var(--text-muted)]">No tracked variants found.</td></tr>
                ) : (
                  filteredVariants.map(variant => (
                    <tr key={variant.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-[var(--text)]">{variant.parent_product_name}</div>
                        <div className="text-sm text-[var(--text-muted)]">{variant.name}</div>
                      </td>
                      <td className="p-4 text-[var(--text)]">{formatRands(variant.cost_price_cents)}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (variant.stock_quantity || 0) > 10
                            ? 'bg-green-500/10 text-green-500'
                            : (variant.stock_quantity || 0) > 0
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-red-500/10 text-red-500'
                        }`}>
                          {variant.stock_quantity || 0} Units
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          variant.status === 'active' ? 'bg-green-500/10 text-green-500' :
                          variant.status === 'draft' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {variant.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenAdjust({
                            id: variant.id,
                            name: `${variant.parent_product_name} - ${variant.name}`,
                            variant_id: variant.id,
                            product_id: variant.parent_product_id,
                            stock: variant.stock_quantity,
                            cost_price_cents: variant.cost_price_cents,
                            status: variant.status
                          })}
                          className="btn-secondary text-xs py-1 px-3 h-auto"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* History Section */}
        <StockHistory />
      </div>
    </>
  );
}

// --- Manage Stock & Cost Modal ---
function AdjustStockModal({ product, onClose, showToast }) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState(product.cost_price_cents ? (product.cost_price_cents / 100).toFixed(2) : '');
  const [reason, setReason] = useState('manual_restock');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Handle variant information
  const productName = product.name || 'Unknown Product';
  const currentStock = product.stock || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const qtyChange = parseInt(quantity) || 0;
      
      // Use the new Netlify function to adjust stock for variants
      const response = await fetch('/.netlify/functions/adjust-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: product.variant_id,
          productId: product.product_id,
          delta: qtyChange,
          reason: reason,
          costPrice: costPrice ? parseFloat(costPrice) : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to adjust stock');
      }

      const result = await response.json();
      showToast('success', result.message || 'Stock updated successfully');

      // CRITICAL: Invalidate the queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product_variants_with_products'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });

      onClose();

    } catch (error) {
      console.error('Error:', error);
      showToast('error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="section-card w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold">Adjust Inventory</h3>
            <p className="text-sm text-[var(--text-muted)]">{productName}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Cost Price (R)</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Add / Remove Stock</label>
            <div className="relative">
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="input"
                placeholder="+5 or -2"
              />
            </div>
            <div className="flex justify-between text-xs text-[var(--text-muted)] px-1">
              <span>Current: {currentStock}</span>
              {quantity && !isNaN(parseInt(quantity)) && (
                <span className={parseInt(quantity) > 0 ? "text-green-400" : "text-red-400"}>
                  New: {currentStock + parseInt(quantity)}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="select"
            >
              <option value="manual_restock">Stock Arrival</option>
              <option value="manual_correction">Inventory Correction</option>
              <option value="manual_damage">Damaged / Expired</option>
              <option value="manual_return">Customer Return</option>
            </select>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isSubmitting ? 'Saving...' : <><Save size={16} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StockHistory() {
  const [filter, setFilter] = useState('all'); // 'all', 'manual', 'order'
  const { data: movements, isLoading } = useQuery({
    queryKey: ['stock_movements'],
    queryFn: api.listStockMovements,
  });

  // Filter movements based on selection
  const filteredMovements = movements?.filter(move => {
    if (filter === 'all') return true;
    
    const reason = move.reason || '';
    const normalizedReason = reason.toLowerCase();
    
    if (filter === 'manual') {
      return normalizedReason.includes('manual') || normalizedReason.includes('adjustment');
    }
    if (filter === 'order') {
      return normalizedReason.includes('order') || normalizedReason.includes('sale');
    }
    return true;
  }) || [];

  // Helper to format the type nicely, regardless of casing
  const formatMovementType = (type) => {
    if (!type) return '-';
    
    // Normalize to lowercase for checking
    const normalized = type.toLowerCase();
    
    // Handle the actual data patterns from Supabase
    if (normalized.includes('manual') || normalized.includes('adjustment')) return 'Manual';
    if (normalized.includes('order') || normalized.includes('sale')) return 'Order';
    
    // Additional patterns
    if (normalized === 'restock') return 'Restock';
    if (normalized === 'return') return 'Return';
    
    // Fallback: Capitalize first letter of whatever it is
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Helper to determine movement type for display

  // Helper to format reason for display
  const formatReason = (reason) => {
    if (!reason) return 'Unknown';
    return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="section-card mt-8">
      <div className="p-6 pb-0">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <History size={20} className="text-[var(--accent)]" />
          Movement History
        </h2>
        
        {/* Filter Controls */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            All ({movements?.length || 0})
          </button>
          <button
            onClick={() => setFilter('manual')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'manual' 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Manual ({movements?.filter(m => {
              const reason = m.reason?.toLowerCase() || '';
              return reason.includes('manual') || reason.includes('adjustment');
            }).length || 0})
          </button>
          <button
            onClick={() => setFilter('order')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              filter === 'order' 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Order ({movements?.filter(m => {
              const reason = m.reason?.toLowerCase() || '';
              return reason.includes('order') || reason.includes('sale');
            }).length || 0})
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
              <th className="p-4">Date</th>
              <th className="p-4">Product</th>
              <th className="p-4">Change</th>
              <th className="p-4">Type</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Ref</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="6" className="p-8 text-center text-[var(--text-muted)]">Loading history...</td></tr>
            ) : filteredMovements.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-[var(--text-muted)]">No {filter !== 'all' ? filter + ' ' : ''}movements recorded yet.</td></tr>
            ) : (
              filteredMovements.map(move => (
                <tr key={move.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-subtle)]">
                  <td className="p-4 text-sm text-[var(--text-muted)]">
                    {new Date(move.created_at).toLocaleString()}
                  </td>
                  <td className="p-4 font-medium">
                    {move.product?.name || move.product_name || 'Unknown Product'}
                    {move.variant_index !== undefined && move.variant_index !== null && (
                      <span className="text-xs text-[var(--text-muted)] ml-1">
                        (Variant {move.variant_index})
                      </span>
                    )}
                  </td>
                  <td className={`p-4 font-bold ${move.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {move.delta > 0 ? `+${move.delta}` : move.delta}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      formatMovementType(move.reason) === 'Manual' 
                        ? 'bg-blue-500/10 text-blue-500' 
                        : formatMovementType(move.reason) === 'Order'
                          ? 'bg-purple-500/10 text-purple-500'
                          : 'bg-gray-500/10 text-gray-500'
                    }`}>
                      {formatMovementType(move.reason)}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-[var(--text-muted)]">
                    {formatReason(move.reason)}
                  </td>
                  <td className="p-4 text-xs font-mono text-[var(--text-muted)]">
                    {move.order_id ? (
                      <span className="text-purple-500">
                        Order: {move.order_id.slice(0,8)}...
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
