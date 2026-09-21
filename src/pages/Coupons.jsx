import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Trash2, TrendingUp, X, Search } from 'lucide-react';

// Helper to format currency
const formatRands = (cents) => {
  if (cents == null || cents === 0) return '-';
  return `R${(cents / 100).toFixed(2)}`;
};

// Helper to detect if a coupon code is a sign-up coupon
// Sign-up coupons follow pattern like: BLOM1105-3B306C
const isSignupCoupon = (code) => {
  return /^BLOM\d{4}-[A-Z0-9]+$/i.test(code);
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

// Helper to get display label for coupon type
const getCouponTypeLabel = (type) => {
  const normalizedType = normalizeCouponType(type);
  return normalizedType === 'percent' ? 'Percentage' : 'Fixed Amount';
};

// Helper to format coupon value for display
const formatCouponValue = (type, value) => {
  if (!value && value !== 0) return '0';
  const numValue = Number(value);
  if (isNaN(numValue)) return '0';
  
  const normalizedType = normalizeCouponType(type);
  if (normalizedType === 'percent') {
    return `${numValue}%`;
  } else {
    // For fixed amount, the value is stored as Rands, not cents
    return `R${numValue.toFixed(2)}`;
  }
};

// Main component for the Specials/Coupons page
export default function Coupons() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [couponFilter, setCouponFilter] = useState('all'); // 'all', 'signup', 'created'
  const [selectedIds, setSelectedIds] = useState(new Set()); // For bulk operations

  // --- Data Fetching ---
  const { data: coupons, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-for-exclusion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, product_type')
        .eq('is_active', true) // <--- FILTER: Only show currently active products
        .order('name', { ascending: true });
        
      if (error) throw new Error(error.message);
      return data || [];
    }
  });

  // --- Event Handlers ---
  const handleAddNew = () => {
    setSelectedCoupon(null);
    setIsFormOpen(true);
  };

  const handleEdit = (coupon) => {
    setSelectedCoupon(coupon);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedCoupon(null);
  };

  const handleDelete = async (couponId) => {
    if (!confirm('Are you sure you want to deactivate this coupon?')) {
      return;
    }
    // We'll just deactivate it, which is safer than deleting.
    await supabase.from('coupons').update({ is_active: false }).eq('id', couponId);
    queryClient.invalidateQueries({ queryKey: ['coupons'] });
  };

  // Bulk selection handlers
  const toggleCouponSelection = (couponId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(couponId)) {
        newSet.delete(couponId);
      } else {
        newSet.add(couponId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCoupons.length) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all
      setSelectedIds(new Set(filteredCoupons.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (!confirm(`Are you sure you want to deactivate ${count} coupon${count > 1 ? 's' : ''}?`)) {
      return;
    }

    // Deactivate all selected coupons
    const idsArray = Array.from(selectedIds);
    await supabase.from('coupons').update({ is_active: false }).in('id', idsArray);

    // Clear selection and refresh
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['coupons'] });
  };

  // Filter coupons based on selected filter
  const filteredCoupons = useMemo(() => {
    if (!coupons) return [];
    if (couponFilter === 'all') return coupons;
    if (couponFilter === 'signup') return coupons.filter(c => isSignupCoupon(c.code));
    if (couponFilter === 'created') return coupons.filter(c => !isSignupCoupon(c.code));
    return coupons;
  }, [coupons, couponFilter]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Specials & Coupons</h1>
        <button
          onClick={handleAddNew}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span>New Coupon</span>
        </button>
      </div>

      {isFormOpen && (
        <CouponForm
          coupon={selectedCoupon}
          onClose={handleCloseForm}
          products={products}
          isLoadingProducts={isLoadingProducts}
        />
      )}

      <div className="section-card mt-8">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Active Coupons</h2>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={16} />
                <span>Delete {selectedIds.size} selected</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="coupon-filter" className="text-sm text-text-muted">Filter:</label>
            <select
              id="coupon-filter"
              value={couponFilter}
              onChange={(e) => {
                setCouponFilter(e.target.value);
                setSelectedIds(new Set()); // Clear selection when filter changes
              }}
              className="select text-sm py-1 px-2"
            >
              <option value="all">All Coupons</option>
              <option value="signup">Sign-up Coupons</option>
              <option value="created">Created Coupons</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="p-3 w-12">
                  <input
                    type="checkbox"
                    checked={filteredCoupons.length > 0 && selectedIds.size === filteredCoupons.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 rounded"
                    title="Select all"
                  />
                </th>
                <th className="p-3">Code</th>
                <th className="p-3">Type</th>
                <th className="p-3">Value</th>
                <th className="p-3">Min. Spend</th>
                <th className="p-3">Max Discount</th>
                <th className="p-3">Usage</th>
                <th className="p-3">Exclusions</th>
                <th className="p-3">Expires</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan="11" className="p-4 text-center">Loading coupons...</td></tr>
              )}
              {filteredCoupons && filteredCoupons.map((coupon) => (
                <tr key={coupon.id} className={`border-b border-border hover:bg-white/5 ${selectedIds.has(coupon.id) ? 'bg-accent/5' : ''}`}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(coupon.id)}
                      onChange={() => toggleCouponSelection(coupon.id)}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                  <td className="p-3 font-mono">{coupon.code}</td>
                  <td className="p-3">{getCouponTypeLabel(coupon.type)}</td>
                  <td className="p-3">
                    {isSignupCoupon(coupon.code) 
                      ? '10%'  // All signup coupons should display as 10%
                      : formatCouponValue(coupon.type, coupon.value)
                    }
                  </td>
                  <td className="p-3">{formatRands(coupon.min_order_cents)}</td>
                  <td className="p-3">{formatRands(coupon.max_discount_cents)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={16} className="text-accent" />
                      {coupon.used_count || 0} / {coupon.max_uses || '∞'}
                    </div>
                  </td>
                  <td className="p-3">
                    {coupon.excluded_product_ids && coupon.excluded_product_ids.length > 0 ? (
                      <span className="text-red-400 text-sm">
                        {coupon.excluded_product_ids.length} products
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-3">
                    <span className={`status-badge ${coupon.is_active ? 'status-active' : 'status-archived'}`}>
                      {coupon.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(coupon)} className="p-1 hover:text-accent">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(coupon.id)} className="p-1 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Coupon Form Component ---
function CouponForm({ coupon, onClose, products = [], isLoadingProducts = false }) {
  // Reuse the same normalizeCouponType function
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
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    id: coupon?.id || null,
    code: coupon?.code || '',
    description: coupon?.notes || '', // Read from 'notes'
    is_active: coupon?.is_active ?? true,
    type: normalizeCouponType(coupon?.type) || 'percent', // Use 'type' with normalization
    value: coupon?.value || 0, // Use 'value'
    min_spend: coupon ? (coupon.min_order_cents / 100).toFixed(2) : '0.00', // Read from 'min_order_cents'
    max_discount: coupon ? (coupon.max_discount_cents ? (coupon.max_discount_cents / 100).toFixed(2) : '') : '',
    max_uses: coupon?.max_uses || 1,
    valid_from: coupon?.valid_from ? coupon.valid_from.split('T')[0] : '',
    valid_until: coupon?.valid_until ? coupon.valid_until.split('T')[0] : '',
    excluded_product_ids: coupon?.excluded_product_ids || [],
  });

  const [productSearchTerm, setProductSearchTerm] = useState('');

  const mutation = useMutation({
    mutationFn: async (formData) => {
      const response = await fetch('/.netlify/functions/save-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to save coupon');
      return result.coupon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      onClose();
    },
    onError: (error) => {
      console.error('Save error:', error);
      alert('Error saving coupon: ' + error.message);
    }
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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
    ).slice(0, 50); // Limit for performance
  }, [products, productSearchTerm]);

  const excludedProductsMap = useMemo(() => {
    return new Map(products.filter(p => formState.excluded_product_ids.includes(p.id)).map(p => [p.id, p]));
  }, [products, formState.excluded_product_ids]);

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(formState);
  };

  return (
    <div className="section-card p-6 mb-8">
      <h2 className="text-xl font-semibold mb-6">
        {coupon ? 'Edit Coupon' : 'Create New Coupon'}
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Col 1 */}
        <div className="md:col-span-1 space-y-4">
          <div className="form-group">
            <label htmlFor="code">Coupon Code</label>
            <input
              type="text"
              id="code"
              name="code"
              value={formState.code}
              onChange={handleChange}
              className="input"
              placeholder="e.g., WELCOME10"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="description">Description (Internal)</label>
            <textarea
              id="description"
              name="description"
              value={formState.description}
              onChange={handleChange}
              className="textarea"
              placeholder="e.g., Welcome discount for new customers"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formState.is_active}
              onChange={handleChange}
              className="h-5 w-5 rounded"
            />
            <label htmlFor="is_active">Activate Coupon</label>
          </div>
        </div>

        {/* Col 2 */}
        <div className="md:col-span-1 space-y-4">
          <div className="form-group">
            <label htmlFor="type">Discount Type</label>
            <select
              id="type"
              name="type"
              value={formState.type}
              onChange={handleChange}
              className="select"
            >
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount (R)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="value">
              Value ({formState.type === 'percent' ? '%' : 'R'})
            </label>
            <input
              type="number"
              id="value"
              name="value"
              value={formState.value}
              onChange={handleChange}
              className="input"
              step="0.01"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="max_discount">Max Discount (R)</label>
            <input
              type="number"
              id="max_discount"
              name="max_discount"
              value={formState.max_discount}
              onChange={handleChange}
              className="input"
              placeholder="e.g., 100 (for R100 max)"
              step="0.01"
              disabled={formState.type === 'fixed'}
            />
            <small className="text-text-muted">
              {formState.type === 'percent'
                ? 'Max R value off for % discounts. Leave empty for no limit.'
                : 'Not needed for fixed discounts.'}
            </small>
          </div>
        </div>

        {/* Col 3 */}
        <div className="md:col-span-1 space-y-4">
          <div className="form-group">
            <label htmlFor="min_spend">Minimum Spend (R)</label>
            <input
              type="number"
              id="min_spend"
              name="min_spend"
              value={formState.min_spend}
              onChange={handleChange}
              className="input"
              placeholder="e.g., 500 (for R500)"
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label htmlFor="max_uses">Total Usage Limit</label>
            <input
              type="number"
              id="max_uses"
              name="max_uses"
              value={formState.max_uses}
              onChange={handleChange}
              className="input"
              placeholder="e.g., 100"
              step="1"
            />
          </div>
          <div className="form-group">
            <label htmlFor="valid_until">Expiry Date</label>
            <input
              type="date"
              id="valid_until"
              name="valid_until"
              value={formState.valid_until}
              onChange={handleChange}
              className="input"
            />
          </div>
        </div>

        {/* Product Exclusions Section */}
        <div className="md:col-span-3 pt-4 mt-4 border-t border-border">
          <label className="block text-sm font-medium mb-2">
            Exclude Products
            {formState.excluded_product_ids.length > 0 && (
              <span className="ml-2 text-text-muted">
                ({formState.excluded_product_ids.length} selected)
              </span>
            )}
          </label>
          <p className="text-xs text-text-muted mb-3">
            Select products that this coupon CANNOT be applied to.
          </p>

          {/* Selected exclusions as tags */}
          {formState.excluded_product_ids.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {formState.excluded_product_ids.map(id => {
                const product = excludedProductsMap.get(id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 px-2 py-1 rounded-md text-sm"
                  >
                    {product ? product.name : id}
                    <button
                      type="button"
                      onClick={() => handleProductExclusionToggle(id)}
                      className="hover:text-red-300"
                    >
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search input */}
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              className="input pl-9"
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
              disabled={isLoadingProducts}
            />
          </div>

          {isLoadingProducts && (
            <p className="text-sm text-text-muted">Loading products...</p>
          )}

          {/* Product list */}
          {!isLoadingProducts && (
            <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-bg">
              {filteredProducts.length === 0 ? (
                <div className="p-3 text-sm text-text-muted text-center">
                  {productSearchTerm ? 'No products found matching your search.' : 'No products available.'}
                </div>
              ) : (
                filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-2 border-b border-border last:border-b-0 hover:bg-white/5 cursor-pointer"
                    onClick={() => handleProductExclusionToggle(product.id)}
                  >
                    <input
                      type="checkbox"
                      checked={formState.excluded_product_ids.includes(product.id)}
                      onChange={() => {}}
                      className="h-4 w-4 rounded"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{product.name}</span>
                      {product.sku && (
                        <span className="text-xs text-text-muted ml-2">({product.sku})</span>
                      )}
                      <span className="text-xs text-text-muted ml-2">
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
        <div className="md:col-span-3 flex justify-end gap-4 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : (coupon ? 'Save Changes' : 'Create Coupon')}
          </button>
        </div>
      </form>
    </div>
  );
}
