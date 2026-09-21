import { useState, useMemo } from "react";
import { Sparkles, Plus, Edit, Trash2, TrendingUp, X, Search, Tag } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import { api } from "@/components/data/api";
import { supabase } from '../lib/supabase';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Helper to format currency for coupons
const formatRands = (cents) => {
  if (cents == null || cents === 0) return '-';
  return `R${(cents / 100).toFixed(2)}`;
};

// Helper to normalize coupon type to valid database values
const normalizeCouponType = (type) => {
  if (!type) return 'percent';
  const lowerType = String(type).toLowerCase().trim();
  if (lowerType === 'percentage' || lowerType === 'percent' || lowerType === '%' || lowerType.includes('percent')) {
    return 'percent';
  }
  if (lowerType === 'fixed' || lowerType === 'r' || lowerType === 'rand' || lowerType === 'amount' || lowerType.includes('fixed')) {
    return 'fixed';
  }
  return 'percent'; // Default fallback
};

export default function Specials() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Coupon state
  const [isCouponFormOpen, setIsCouponFormOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [couponFilter, setCouponFilter] = useState('all'); // 'all', 'signup', 'created', 'active', 'inactive'

  // Special/Promotion form state

  // Data fetching
  const { isFetching: productsFetching } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const list = await (api?.listProducts?.() || Promise.resolve([]));
      return Array.isArray(list) ? list.filter(p => (p?.status || 'active') === 'active') : [];
    },
  });

  const { isFetching: bundlesFetching } = useQuery({
    queryKey: ['bundles'],
    queryFn: async () => {
      const list = await (api?.listBundles?.() || Promise.resolve([]));
      return Array.isArray(list) ? list.filter(b => (b?.status || 'active') === 'active') : [];
    },
  });

  const { isFetching: specialsFetching } = useQuery({
    queryKey: ['specials'],
    queryFn: async () => {
      const list = await (api?.listSpecials?.() || Promise.resolve([]));
      return Array.isArray(list) ? list : [];
    },
  });

  // Coupons data
  const { data: coupons = [], isLoading: couponsLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  // Products for exclusion (from Supabase)
  const { data: productsForExclusion = [], isLoading: productsForExclusionLoading } = useQuery({
    queryKey: ['products-for-exclusion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, product_type')
        .or('status.eq.active,status.is.null')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    }
  });

  const loading = productsFetching || bundlesFetching || specialsFetching;

  // Helper to detect sign-up coupons (pattern: BLOM####-XXXXXX)
  const isSignupCoupon = (code) => {
    return /^BLOM\d{4}-[A-Z0-9]+$/i.test(code);
  };

  // Filtered coupons based on selected filter (sign-up coupons are hidden by default)
  const filteredCoupons = useMemo(() => {
    if (!coupons || coupons.length === 0) return [];

    switch (couponFilter) {
      case 'signup':
        return coupons.filter(c => isSignupCoupon(c.code));
      case 'created':
        return coupons.filter(c => !isSignupCoupon(c.code));
      case 'active':
        return coupons.filter(c => c.is_active && !isSignupCoupon(c.code));
      case 'inactive':
        return coupons.filter(c => !c.is_active && !isSignupCoupon(c.code));
      default:
        // Default 'all' filter now excludes sign-up coupons
        return coupons.filter(c => !isSignupCoupon(c.code));
    }
  }, [coupons, couponFilter]);






  // Coupon handlers
  const handleAddNewCoupon = () => {
    setSelectedCoupon(null);
    setIsCouponFormOpen(true);
  };

  const handleEditCoupon = (coupon) => {
    setSelectedCoupon(coupon);
    setIsCouponFormOpen(true);
    // Scroll to top to show the edit form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseCouponForm = () => {
    setIsCouponFormOpen(false);
    setSelectedCoupon(null);
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!confirm('Are you sure you want to permanently delete this coupon? This action cannot be undone.')) {
      return;
    }
    try {
      const response = await fetch('/.netlify/functions/delete-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: couponId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete coupon');
      }
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      showToast('success', 'Coupon deleted permanently');
    } catch (err) {
      console.error('Error deleting coupon:', err);
      showToast('error', 'Failed to delete coupon: ' + err.message);
    }
  };

  const [fixingSignupCoupons, setFixingSignupCoupons] = useState(false);

  const handleFixSignupCoupons = async () => {
    if (!confirm('This will update all sign-up coupons (BLOM####-XXXXXX pattern) to be 10% percentage discounts. Continue?')) {
      return;
    }

    setFixingSignupCoupons(true);
    try {
      const response = await fetch('/.netlify/functions/fix-signup-coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fix coupons');
      }

      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      showToast('success', result.message);
    } catch (err) {
      console.error('Error fixing sign-up coupons:', err);
      showToast('error', 'Failed to fix sign-up coupons: ' + err.message);
    } finally {
      setFixingSignupCoupons(false);
    }
  };

   // All specials for management
  


  if (loading) {
    return (
      <div className="specials-header">
        <h1 className="header-title">
          <Sparkles className="w-8 h-8" />
          Specials & Promotions
        </h1>
        <p className="text-gray-500">Loading specials data...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .specials-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .header-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          background: var(--card);
          padding: 6px;
          border-radius: 12px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          flex-wrap: wrap;
        }

        .tab {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab.active {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .create-form {
          background: var(--card);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        .form-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }

        @media (max-width: 768px) {
          .form-grid, .form-grid-3 {
            grid-template-columns: 1fr;
          }
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-input, .form-select, .form-textarea {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
        }

        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
        }

        .form-input-search {
          padding-left: 42px;
        }

        .targets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .target-card {
          padding: 12px 16px;
          border-radius: 10px;
          background: var(--card);
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .target-card:hover {
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .target-card.selected {
          background: linear-gradient(135deg, rgba(110, 193, 255, 0.2), rgba(255, 119, 233, 0.2));
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .target-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .target-name {
          flex: 1;
          font-weight: 600;
          font-size: 14px;
          color: var(--text);
        }

        .preview-section {
          margin-top: 32px;
          padding-top: 32px;
          border-top: 2px solid var(--border);
        }

        .preview-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 20px;
        }

        .preview-grid {
          display: grid;
          gap: 16px;
        }

        .preview-item {
          background: var(--bg);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .preview-item-name {
          font-weight: 600;
          color: var(--text);
        }

        .preview-prices {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .preview-old-price {
          color: var(--text-muted);
          text-decoration: line-through;
          font-size: 14px;
        }

        .preview-new-price {
          color: var(--accent);
          font-weight: 700;
          font-size: 18px;
        }

        .preview-savings {
          padding: 4px 12px;
          border-radius: 8px;
          background: #10b98120;
          color: #10b981;
          font-size: 12px;
          font-weight: 700;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .btn-activate {
          padding: 14px 32px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 32px;
        }

        .btn-activate:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-activate:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .btn-secondary {
          padding: 14px 32px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .btn-secondary:hover {
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
        }

        .specials-list {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .special-card {
          padding: 20px;
          border-radius: 12px;
          background: var(--bg);
          margin-bottom: 16px;
        }

        .special-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 12px;
        }

        .special-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
        }

        .special-badge {
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .badge-active {
          background: #10b98120;
          color: #10b981;
        }

        .badge-scheduled {
          background: #3b82f620;
          color: #3b82f6;
        }

        .badge-expired {
          background: #6b728020;
          color: #6b7280;
        }

        .badge-inactive {
          background: #ef444420;
          color: #ef4444;
        }

        .special-details {
          color: var(--text-muted);
          font-size: 14px;
          line-height: 1.8;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-muted);
        }

        .coupon-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .coupon-table th {
          text-align: left;
          padding: 12px 16px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border);
        }

        .coupon-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }

        .coupon-table tr:hover td {
          background: var(--bg);
        }

        .coupon-code {
          font-family: monospace;
          font-weight: 700;
          font-size: 15px;
          color: var(--accent);
        }

        .exclusion-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ef444420;
          color: #ef4444;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .product-exclusion-list {
          max-height: 200px;
          overflow-y: auto;
          background: var(--bg);
          border-radius: 12px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .product-exclusion-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .product-exclusion-item:last-child {
          border-bottom: none;
        }

        .product-exclusion-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .selected-exclusions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }

        .selected-exclusion-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ef444420;
          color: #ef4444;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
        }

        .selected-exclusion-tag button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
        }

        .selected-exclusion-tag button:hover {
          color: #fca5a5;
        }

        .action-btn {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: var(--text-muted);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .action-btn:hover {
          color: var(--accent);
          background: var(--bg);
        }

        .action-btn.delete:hover {
          color: #ef4444;
        }
      `}</style>

      <div className="specials-header">
        <h1 className="header-title">
          <Tag className="w-8 h-8" />
          Coupons
        </h1>
      </div>

      {/* COUPONS CONTENT */}
        <div>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <button 
              className="btn-activate" 
              onClick={handleAddNewCoupon}
            >
              <Plus className="w-5 h-5" />
              New Coupon
            </button>

            {/* Filter Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Filter:</label>
              <select
                className="form-select"
                value={couponFilter}
                onChange={(e) => setCouponFilter(e.target.value)}
                style={{ width: 'auto', minWidth: '180px' }}
              >
                <option value="all">All Displayed Coupons ({coupons.filter(c => !isSignupCoupon(c.code)).length})</option>
                <option value="signup">Sign-up Coupons ({coupons.filter(c => isSignupCoupon(c.code)).length})</option>
                <option value="created">Created Coupons ({coupons.filter(c => !isSignupCoupon(c.code)).length})</option>
                <option value="active">Active ({coupons.filter(c => c.is_active && !isSignupCoupon(c.code)).length})</option>
                <option value="inactive">Inactive ({coupons.filter(c => !c.is_active && !isSignupCoupon(c.code)).length})</option>
              </select>

              {/* Fix Sign-up Coupons Button - Only show when viewing sign-up coupons specifically */}
              {couponFilter === 'signup' && coupons.filter(c => isSignupCoupon(c.code) && (c.type !== 'percentage' || c.value !== 10)).length > 0 && (
                <button
                  className="btn-secondary"
                  onClick={handleFixSignupCoupons}
                  disabled={fixingSignupCoupons}
                  style={{ padding: '10px 16px', fontSize: '14px' }}
                  title="Fix sign-up coupons to be 10% discount"
                >
                  {fixingSignupCoupons ? 'Fixing...' : 'Fix Sign-up Coupons'}
                </button>
              )}
            </div>
          </div>

          {isCouponFormOpen && (
            <CouponForm
              coupon={selectedCoupon}
              onClose={handleCloseCouponForm}
              products={productsForExclusion}
              isLoadingProducts={productsForExclusionLoading}
              showToast={showToast}
            />
          )}

          <div className="specials-list">
            <h3 className="preview-title">
              {couponFilter === 'all' && 'All Displayed Coupons'}
              {couponFilter === 'signup' && 'Sign-up Coupons (Hidden by Default)'}
              {couponFilter === 'created' && 'Created Coupons'}
              {couponFilter === 'active' && 'Active Coupons'}
              {couponFilter === 'inactive' && 'Inactive Coupons'}
              {' '}({filteredCoupons.length})
            </h3>
            {couponsLoading ? (
              <div className="empty-state">Loading coupons...</div>
            ) : coupons.length === 0 ? (
              <div className="empty-state">No coupons created yet</div>
            ) : filteredCoupons.length === 0 ? (
              <div className="empty-state">No coupons match the selected filter</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="coupon-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Source</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Min. Spend</th>
                      <th>Max Discount</th>
                      <th>Usage</th>
                      <th>Exclusions</th>
                      <th>Expires</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoupons.map((coupon) => (
                      <tr key={coupon.id}>
                        <td className="coupon-code">{coupon.code}</td>
                        <td>
                          <span className={`special-badge ${isSignupCoupon(coupon.code) ? 'badge-scheduled' : 'badge-active'}`}>
                            {isSignupCoupon(coupon.code) ? 'Sign-up' : 'Created'}
                          </span>
                        </td>
                        <td>{normalizeCouponType(coupon.type) === 'percent' ? 'Percentage' : 'Fixed Amount'}</td>
                        <td>
                          {normalizeCouponType(coupon.type) === 'percent'
                            ? `${coupon.percent || coupon.value}%`
                            : `R${Number(coupon.value).toFixed(2)}`}
                        </td>
                        <td>{formatRands(coupon.min_order_cents)}</td>
                        <td>{formatRands(coupon.max_discount_cents)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={16} className="text-accent" />
                            {coupon.used_count || 0} / {coupon.max_uses || '∞'}
                          </div>
                        </td>
                        <td>
                          {coupon.excluded_product_ids && coupon.excluded_product_ids.length > 0 ? (
                            <span className="exclusion-tag">
                              {coupon.excluded_product_ids.length} products
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : '-'}
                        </td>
                        <td>
                          <span className={`special-badge ${coupon.is_active ? 'badge-active' : 'badge-inactive'}`}>
                            {coupon.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleEditCoupon(coupon)} className="action-btn">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteCoupon(coupon.id)} className="action-btn delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
    </>
  );
}

// --- Coupon Form Component with neumorphic styling ---
function CouponForm({ coupon, onClose, products = [], isLoadingProducts = false, showToast }) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState(() => {
    const normalizedType = normalizeCouponType(coupon?.type);
    const initialPercent = normalizedType === 'percent' ? (coupon?.percent || coupon?.value || 0) : 0;
    const initialValue = normalizedType === 'fixed' ? (coupon?.value || 0) : '';
    
    return {
      id: coupon?.id || null,
      code: coupon?.code || '',
      description: coupon?.notes || '',
      is_active: coupon?.is_active ?? true,
      type: normalizedType,
      value: initialValue,
      percent: initialPercent,
      min_spend: coupon ? (coupon.min_order_cents / 100).toFixed(2) : '0.00',
      max_discount: coupon ? (coupon.max_discount_cents ? (coupon.max_discount_cents / 100).toFixed(2) : '') : '',
      max_uses: coupon?.max_uses || 1,
      valid_from: coupon?.valid_from ? coupon.valid_from.split('T')[0] : '',
      valid_until: coupon?.valid_until ? coupon.valid_until.split('T')[0] : '',
      excluded_product_ids: coupon?.excluded_product_ids || [],
    };
  });



  const [productSearchTerm, setProductSearchTerm] = useState('');

  const mutation = useMutation({
    mutationFn: async (formData) => {
      console.log('🌐 Making API call to save-coupon...');
      console.log('📤 API payload:', formData);
      
      const response = await fetch('/.netlify/functions/save-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      console.log('📡 API response status:', response.status);
      console.log('📡 API response ok:', response.ok);
      
      const result = await response.json();
      console.log('📡 API response data:', result);
      
      if (!response.ok) {
        console.error('❌ API call failed:', result);
        throw new Error(result.error || 'Failed to save coupon');
      }
      
      console.log('✅ API call successful');
      return result.coupon;
    },
    onSuccess: (result) => {
      console.log('✅ Coupon saved successfully:', result);
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      queryClient.refetchQueries({ queryKey: ['coupons'] });
      onClose();
      showToast('success', 'Coupon saved successfully');
    },
    onError: (error) => {
      console.error('❌ Mutation error:', error);
      console.error('❌ Error message:', error.message);
      showToast('error', 'Error saving coupon: ' + error.message);
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => {
      const newState = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };
      
      // When discount type changes, clear the other field
      if (name === 'type') {
        if (value === 'fixed') {
          newState.percent = 0; // Clear percentage when switching to fixed
          newState.value = newState.value || ''; // Ensure value is string for fixed
        } else {
          newState.value = ''; // Clear fixed value when switching to percent
          newState.percent = newState.percent || 0; // Ensure percent is number
        }
      }
      
      // Validate percentage field
      if (name === 'percent') {
        const percentValue = parseInt(value);
        if (percentValue > 100) {
          newState.percent = 100;
        } else if (percentValue < 0) {
          newState.percent = 1;
        }
      }
      
      return newState;
    });
  };

  const handleProductExclusionToggle = (productId) => {
    setFormState(prev => {
      const excluded = prev.excluded_product_ids;
      if (excluded.includes(productId)) {
        return { ...prev, excluded_product_ids: excluded.filter(id => id !== productId) };
      } else {
        return { ...prev, excluded_product_ids: [...excluded, productId] };
      }
    });
  };

  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const term = productSearchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    ).slice(0, 50);
  }, [products, productSearchTerm]);

  const excludedProductsMap = useMemo(() => {
    return new Map(products.filter(p => formState.excluded_product_ids.includes(p.id)).map(p => [p.id, p]));
  }, [products, formState.excluded_product_ids]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    console.log('🚀 Form submission started!');
    console.log('📋 Current form state:', formState);
    
    // Basic validation
    if (!formState.code.trim()) {
      console.error('❌ Validation failed: No coupon code');
      showToast('error', 'Please enter a coupon code');
      return;
    }
    
    // Validation for discount values
    if (formState.type === 'percent') {
      const percentValue = parseInt(formState.percent);
      console.log('📊 Percent validation:', { percentValue, type: typeof percentValue });
      if (!percentValue || percentValue < 1 || percentValue > 100) {
        console.error('❌ Validation failed: Invalid percentage');
        showToast('error', 'Please enter a valid percentage between 1 and 100');
        return;
      }
    } else if (formState.type === 'fixed') {
      const fixedValue = parseFloat(formState.value);
      console.log('📊 Fixed validation:', { fixedValue, type: typeof fixedValue, rawValue: formState.value });
      if (isNaN(fixedValue) || fixedValue <= 0) {
        console.error('❌ Validation failed: Invalid fixed amount');
        showToast('error', 'Please enter a valid discount amount greater than 0');
        return;
      }
    }
    
    // Prepare the data for submission based on discount type
    const submissionData = {
      ...formState,
      // Use percent field for percent discounts, value field for fixed discounts
      value: formState.type === 'percent' ? parseInt(formState.percent) : parseFloat(formState.value),
    };
    
    console.log('📤 Submission data prepared:', submissionData);
    console.log('🌐 Starting mutation...');
    
    mutation.mutate(submissionData);
  };

  return (
    <div className="create-form" style={{ marginBottom: '24px' }}>
      <h3 className="preview-title">
        {coupon ? 'Edit Coupon' : 'Create New Coupon'}
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="form-grid-3">
          {/* Col 1 */}
          <div>
            <div className="form-group">
              <label className="form-label">Coupon Code *</label>
              <input
                type="text"
                name="code"
                value={formState.code}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g., WELCOME10"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description (Internal)</label>
              <textarea
                name="description"
                value={formState.description}
                onChange={handleChange}
                className="form-textarea"
                placeholder="e.g., Welcome discount for new customers"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formState.is_active}
                  onChange={handleChange}
                  className="target-checkbox"
                />
                <span className="form-label" style={{ marginBottom: 0 }}>Activate Coupon</span>
              </label>
            </div>
          </div>

          {/* Col 2 */}
          <div>
            <div className="form-group">
              <label className="form-label">Discount Type *</label>
              <select
                name="type"
                value={formState.type}
                onChange={handleChange}
                className="form-select"
              >
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed Amount (R)</option>
              </select>
            </div>
            
            {/* Fixed Amount Field (for 'fixed' type) */}
            <div className="form-group" id="fixedField" style={{ display: formState.type === 'fixed' ? 'block' : 'none' }}>
              <label className="form-label">Discount Amount (Rands) *</label>
              <input
                type="number"
                name="value"
                value={formState.value}
                onChange={handleChange}
                className="form-input"
                placeholder="250"
                step="0.01"
                min="0"
                disabled={formState.type !== 'fixed'}
              />
            </div>

            {/* Percentage Field (for 'percent' type) */}
            <div className="form-group" id="percentField" style={{ display: formState.type === 'percent' ? 'block' : 'none' }}>
              <label className="form-label">Discount Percentage (%) *</label>
              <input
                type="number"
                name="percent"
                value={formState.percent}
                onChange={handleChange}
                className="form-input"
                placeholder="20"
                step="1"
                min="1"
                max="100"
                disabled={formState.type !== 'percent'}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Enter a value between 1 and 100 (e.g., 20 for 20% discount)
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">Total Usage Limit</label>
              <input
                type="number"
                name="max_uses"
                value={formState.max_uses}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g., 100"
                step="1"
              />
            </div>
          </div>

          {/* Col 3 */}
          <div>
            <div className="form-group">
              <label className="form-label">Minimum Spend (R)</label>
              <input
                type="number"
                name="min_spend"
                value={formState.min_spend}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g., 500"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Discount (R)</label>
              <input
                type="number"
                name="max_discount"
                value={formState.max_discount}
                onChange={handleChange}
                className="form-input"
                placeholder="e.g., 100"
                step="0.01"
                disabled={formState.type === 'fixed'}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                {formState.type === 'percent'
                  ? 'Max R value off for % discounts.'
                  : 'Not needed for fixed discounts.'}
              </small>
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date</label>
              <input
                type="date"
                name="valid_until"
                value={formState.valid_until}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* Product Exclusions */}
        <div className="preview-section">
          <label className="form-label">
            Exclude Products
            {formState.excluded_product_ids.length > 0 && (
              <span style={{ marginLeft: '8px', fontWeight: 'normal' }}>
                ({formState.excluded_product_ids.length} selected)
              </span>
            )}
          </label>
          <small style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'block', marginBottom: '16px' }}>
            Select products that this coupon CANNOT be applied to.
          </small>

          {formState.excluded_product_ids.length > 0 && (
            <div className="selected-exclusions">
              {formState.excluded_product_ids.map(id => {
                const product = excludedProductsMap.get(id);
                return (
                  <span key={id} className="selected-exclusion-tag">
                    {product ? product.name : id}
                    <button type="button" onClick={() => handleProductExclusionToggle(id)}>
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              className="form-input form-input-search"
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              disabled={isLoadingProducts}
            />
          </div>

          {isLoadingProducts && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading products...</p>
          )}

          {!isLoadingProducts && (
            <div className="product-exclusion-list">
              {filteredProducts.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {productSearchTerm ? 'No products found matching your search.' : 'No products available.'}
                </div>
              ) : (
                filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="product-exclusion-item"
                    onClick={() => handleProductExclusionToggle(product.id)}
                  >
                    <input
                      type="checkbox"
                      checked={formState.excluded_product_ids.includes(product.id)}
                      onChange={() => {}}
                      className="target-checkbox"
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600 }}>{product.name}</span>
                      {product.sku && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                          ({product.sku})
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        [{product.product_type === 'bundle' ? 'Bundle' : 'Product'}]
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px' }}>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-activate" 
            disabled={mutation.isPending}
          >
            <Sparkles className="w-5 h-5" />
            {mutation.isPending ? 'Saving...' : (coupon ? 'Save Changes' : 'Create Coupon')}
          </button>
        </div>
      </form>
    </div>
  );
}
