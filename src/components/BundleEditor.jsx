import { useState } from "react";
import { ArrowLeft, Save, Plus, X, Monitor, Smartphone, Calculator, Search } from "lucide-react";
import { moneyZAR } from "./formatUtils";
import { ImageUploader } from "@/components/ImageUploader";
import { slugify } from "./helpers";
import { useQuery } from "@tanstack/react-query";
import { api } from "./data/api";
import { useActiveSpecials } from "./hooks/useActiveSpecials";
import { discountLabel } from "./helpers/pricing";
import { useWebhookSender } from "./webhooks/useWebhookSender";

export default function BundleEditor({ bundle, onSave, onCancel, isSaving, title }) {
  const [formData, setFormData] = useState(bundle);
  const [items, setItems] = useState(bundle.items || []);
  const [pricingMode, setPricingMode] = useState(bundle.pricing_mode || 'manual');
  const [discountValue, setDiscountValue] = useState(bundle.discount_value || 0);
  const [previewTab, setPreviewTab] = useState("card");
  const [viewMode, setViewMode] = useState("desktop");
  const [showItemDrawer, setShowItemDrawer] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.listProducts(),
  });

  const { getDisplayPriceCents } = useActiveSpecials();

  // Calculate base price from items
  const basePrice = items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.product_id);
    return sum + (product ? product.price_cents * item.qty : 0);
  }, 0);

  const suggestedPrice = pricingMode === 'manual' ? formData.price_cents :
    pricingMode === 'percent_off' ? Math.max(1, Math.round(basePrice * (1 - discountValue / 100))) :
    Math.max(1, Math.round(basePrice - discountValue * 100));

  // Webhook sender
  const webhookData = formData.name ? {
    id: formData.id || formData.slug,
    name: formData.name,
    slug: formData.slug,
    status: formData.status,
    items: items.map(item => ({ product_id: item.product_id, qty: item.qty })),
    pricing_mode: pricingMode,
    discount_value: discountValue,
    price_cents: formData.price_cents,
    compare_at_price_cents: formData.compare_at_price_cents,
    images: formData.images || [],
    display_price_cents: getDisplayPriceCents('bundle', formData.id, formData.price_cents),
    timestamp: new Date().toISOString()
  } : null;

  useWebhookSender(webhookData, 'bundle.updated');

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNameBlur = () => {
    if (!formData.slug && formData.name) {
      updateField('slug', slugify(formData.name));
    }
  };

  const addItemToBundle = (product, qty = 1) => {
    const existing = items.find(item => item.product_id === product.id);
    if (existing) {
      setItems(prev => prev.map(item =>
        item.product_id === product.id ? { ...item, qty: item.qty + qty } : item
      ));
    } else {
      setItems(prev => [...prev, { product_id: product.id, qty }]);
    }
    setShowItemDrawer(false);
    setSearchTerm("");
  };

  const updateItemQty = (product_id, qty) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(item => item.product_id !== product_id));
    } else {
      setItems(prev => prev.map(item =>
        item.product_id === product_id ? { ...item, qty } : item
      ));
    }
  };

  const removeItem = (product_id) => {
    setItems(prev => prev.filter(item => item.product_id !== product_id));
  };

  const handleRecalculate = () => {
    updateField('price_cents', suggestedPrice);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    onSave({
      ...formData,
      items,
      pricing_mode: pricingMode,
      discount_value: pricingMode === 'manual' ? null : discountValue
    });
  };

  const baseCents = formData.price_cents || 0;
  const compareCents = formData.compare_at_price_cents;
  const displayCents = getDisplayPriceCents('bundle', formData.id, baseCents);
  const originalCents = Math.max(compareCents || 0, baseCents);
  const isDiscounted = displayCents < originalCents;
  const discount = isDiscounted ? discountLabel(originalCents, displayCents) : null;

  const containerWidth = viewMode === "mobile" ? "375px" : "100%";

  // FIX: Filter products to only show active ones matching the search term
  const filteredProducts = products.filter(p => {
    // Check if product is active
    const isActive = p.status === 'active' && p.is_active !== false;
    
    // Check if it matches search
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return isActive && matchesSearch;
  });

  const addGalleryImage = () => {
    const current = formData.images || [];
    updateField('images', [...current, ""]);
  };

  const updateArrayItem = (field, index, value) => {
    const current = formData[field] || [];
    const updated = [...current];
    updated[index] = value;
    updateField(field, updated);
  };

  const removeFromArray = (field, index) => {
    const current = formData[field] || [];
    updateField(field, current.filter((_, i) => i !== index));
  };

  return (
    <>
      <style>{`
        .editor-container { max-width: 1600px; margin: 0 auto; }
        .editor-header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; }
        .btn-back { width: 44px; height: 44px; border-radius: 12px; border: none; background: var(--card); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light); }
        .btn-back:active { box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light); }
        .editor-title { font-size: 28px; font-weight: 700; color: var(--text); flex: 1; }
        .btn-save { padding: 12px 28px; border-radius: 12px; border: none; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: white; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 10px; box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light); transition: transform 0.2s; }
        .btn-save:disabled { opacity: .6; cursor: not-allowed; }
        .btn-save:not(:disabled):hover { transform: translateY(-2px); }
        .editor-grid { display: grid; grid-template-columns: 500px 1fr; gap: 32px; }
        @media (max-width: 1200px) { .editor-grid { grid-template-columns: 1fr; } }
        .form-panel { background: var(--card); border-radius: 20px; padding: 32px; box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light); min-height: calc(100vh - 110px); overflow: visible; }
        .form-section { margin-bottom: 32px; padding-bottom: 32px; border-bottom: 2px solid var(--border); }
        .form-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .section-title { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 20px; text-transform: uppercase; letter-spacing: .05em; }
        .form-group { margin-bottom: 20px; }
        .form-label { display: block; font-size: 13px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px; text-transform: uppercase; letter-spacing: .05em; }
        .form-input, .form-textarea, .form-select { width: 100%; padding: 14px 18px; border-radius: 12px; border: none; background: var(--card); color: var(--text); font-size: 15px; font-family: inherit; box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light); transition: box-shadow .2s; }
        .form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light); }
        .form-textarea { min-height: 100px; resize: vertical; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .array-list { display: flex; flex-direction: column; gap: 12px; }
        .array-item { display: flex; gap: 8px; align-items: center; }
        .btn-icon-small { width: 36px; height: 36px; border-radius: 8px; border: none; background: var(--card); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light); flex-shrink: 0; }
        .btn-icon-small:hover { color: var(--text); }
        .btn-icon-small:active { box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light); }
        .btn-add { padding: 10px 16px; border-radius: 10px; border: none; background: var(--card); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light); margin-top: 8px; }
        .btn-add:hover { box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light); }

        .preview-panel { display: flex; flex-direction: column; gap: 24px; }
        .preview-controls { background: var(--card); border-radius: 16px; padding: 20px; box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light); display: flex; justify-content: space-between; align-items: center; }
        .preview-tabs { display: flex; gap: 8px; }
        .preview-tab { padding: 10px 20px; border-radius: 10px; border: none; background: var(--card); color: var(--text-muted); font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light); transition: all .2s; }
        .preview-tab.active { background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: white; box-shadow: inset 2px 2px 4px rgba(0,0,0,0.3); }
        .view-toggle { display: flex; gap: 8px; }
        .view-btn { width: 40px; height: 40px; border-radius: 10px; border: none; background: var(--card); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light); }
        .view-btn.active { color: var(--accent); box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light); }
        .preview-container { background: var(--card); border-radius: 16px; padding: 32px; box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light); display: flex; justify-content: center; }
        .preview-wrapper { width: ${containerWidth}; max-width: 100%; }
        .product-card { background: var(--bg); border-radius: 16px; overflow: hidden; box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light); }
        .card-image { width: 100%; aspect-ratio: 1; object-fit: cover; background: linear-gradient(135deg, rgba(110,193,255,.1), rgba(255,119,233,.1)); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px; }
        .card-content { padding: 20px; }
        .card-title { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .card-desc { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5; }
        .card-price-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .card-price { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--accent-2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .card-compare-price { font-size: 16px; color: var(--text-muted); text-decoration: line-through; }
        .card-badge { padding: 4px 12px; border-radius: 8px; background: #10b98120; color: #10b981; font-size: 12px; font-weight: 700; }
        .pdp-container { font-size: ${viewMode === "mobile" ? "14px" : "16px"}; }
        .pdp-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .pdp-thumb { aspect-ratio: 1; border-radius: 12px; background: linear-gradient(135deg, rgba(110,193,255,.1), rgba(255,119,233,.1)); display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted); overflow: hidden; }
        .pdp-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .pdp-title { font-size: ${viewMode === "mobile" ? "20px" : "28px"}; font-weight: 700; color: var(--text); margin-bottom: 16px; }
        .pdp-price-block { margin-bottom: 20px; }
        .pdp-price { font-size: ${viewMode === "mobile" ? "28px" : "36px"}; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--accent-2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
        .pdp-short-desc { color: var(--text-muted); margin-bottom: 24px; line-height: 1.6; }
        
        .item-drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          display: ${showItemDrawer ? 'block' : 'none'};
        }

        .item-drawer {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: 400px;
          max-width: 90vw;
          background: var(--card);
          box-shadow: -8px 0 24px var(--shadow-dark);
          z-index: 1001;
          transform: translateX(${showItemDrawer ? '0' : '100%'});
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .drawer-header {
          padding: 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .drawer-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }

        .drawer-search {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
        }

        .search-input-wrapper {
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border-radius: 12px;
          border: none;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }

        .product-list-item {
          padding: 16px;
          border-radius: 12px;
          background: var(--bg);
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .product-list-item:hover {
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .product-list-name {
          font-weight: 600;
          color: var(--text);
          margin-bottom: 4px;
        }

        .product-list-price {
          font-size: 14px;
          color: var(--text-muted);
        }

        .items-table {
          width: 100%;
          margin-top: 12px;
        }

        .items-table th {
          text-align: left;
          padding: 12px 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border);
        }

        .items-table td {
          padding: 12px 8px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }

        .qty-stepper {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .qty-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: none;
          background: var(--card);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
        }

        .qty-btn:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .qty-value {
          min-width: 32px;
          text-align: center;
          font-weight: 600;
        }

        .pricing-radios {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .radio-btn {
          flex: 1;
          padding: 12px 16px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
          transition: all 0.2s;
        }

        .radio-btn.active {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.3);
        }

        .price-summary {
          background: var(--bg);
          border-radius: 12px;
          padding: 16px;
          margin-top: 16px;
          font-size: 14px;
        }

        .price-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          color: var(--text);
        }

        .price-row.total {
          font-size: 18px;
          font-weight: 700;
          border-top: 2px solid var(--border);
          margin-top: 8px;
          padding-top: 16px;
        }
      `}</style>

      <div className="editor-container">
        <div className="editor-header">
          <button className="btn-back" onClick={onCancel} type="button">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="editor-title">{title}</h1>
          <button className="btn-save" onClick={handleSubmit} disabled={isSaving} type="button">
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving...' : 'Save Bundle'}
          </button>
        </div>

        

        <form onSubmit={handleSubmit}>
          <div className="editor-grid">
            <div className="form-panel">
              {/* CORE */}
              <div className="form-section">
                <h3 className="section-title">Core</h3>
                
                <div className="form-group">
                  <label className="form-label">Bundle Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    onBlur={handleNameBlur}
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Slug</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.slug || ''}
                      onChange={(e) => updateField('slug', e.target.value)}
                      placeholder="auto-generated from name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => updateField('status', e.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ITEMS */}
              <div className="form-section">
                <h3 className="section-title">Bundle Items</h3>
                
                {items.length > 0 ? (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Qty</th>
                        <th>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const product = products.find(p => p.id === item.product_id);
                        if (!product) return null;
                        return (
                          <tr key={item.product_id}>
                            <td>{product.name}</td>
                            <td>{moneyZAR(product.price_cents)}</td>
                            <td>
                              <div className="qty-stepper">
                                <button
                                  type="button"
                                  className="qty-btn"
                                  onClick={() => updateItemQty(item.product_id, item.qty - 1)}
                                >
                                  –
                                </button>
                                <div className="qty-value">{item.qty}</div>
                                <button
                                  type="button"
                                  className="qty-btn"
                                  onClick={() => updateItemQty(item.product_id, item.qty + 1)}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td>{moneyZAR(product.price_cents * item.qty)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn-icon-small"
                                onClick={() => removeItem(item.product_id)}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No items yet
                  </div>
                )}
                
                <button
                  type="button"
                  className="btn-add"
                  onClick={() => setShowItemDrawer(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>

              {/* PRICING */}
              <div className="form-section">
                <h3 className="section-title">Pricing</h3>
                
                <div className="pricing-radios">
                  <button
                    type="button"
                    className={`radio-btn ${pricingMode === 'manual' ? 'active' : ''}`}
                    onClick={() => setPricingMode('manual')}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    className={`radio-btn ${pricingMode === 'percent_off' ? 'active' : ''}`}
                    onClick={() => setPricingMode('percent_off')}
                  >
                    % Off
                  </button>
                  <button
                    type="button"
                    className={`radio-btn ${pricingMode === 'amount_off' ? 'active' : ''}`}
                    onClick={() => setPricingMode('amount_off')}
                  >
                    R Off
                  </button>
                </div>

                {pricingMode !== 'manual' && (
                  <div className="form-group">
                    <label className="form-label">
                      {pricingMode === 'percent_off' ? 'Discount %' : 'Discount R'}
                    </label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="number"
                        className="form-input"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        min="0"
                        max={pricingMode === 'percent_off' ? "90" : undefined}
                        step={pricingMode === 'amount_off' ? '0.01' : '1'}
                      />
                      <button
                        type="button"
                        className="btn-add"
                        onClick={handleRecalculate}
                        style={{ marginTop: 0 }}
                      >
                        <Calculator className="w-4 h-4" />
                        Recalculate
                      </button>
                    </div>
                  </div>
                )}

                <div className="price-summary">
                  <div className="price-row">
                    <span>Base (from items):</span>
                    <strong>{moneyZAR(basePrice)}</strong>
                  </div>
                  {pricingMode !== 'manual' && (
                    <div className="price-row">
                      <span>Suggested:</span>
                      <strong>{moneyZAR(suggestedPrice)}</strong>
                    </div>
                  )}
                  <div className="price-row total">
                    <span>Final Price:</span>
                    <strong>{moneyZAR(formData.price_cents)}</strong>
                  </div>
                </div>

                {pricingMode === 'manual' && (
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">Price (cents)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.price_cents}
                      onChange={(e) => updateField('price_cents', parseInt(e.target.value) || 0)}
                      min="1"
                    />
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {moneyZAR(formData.price_cents)}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Compare At (cents)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.compare_at_price_cents || ''}
                    onChange={(e) => updateField('compare_at_price_cents', e.target.value ? parseInt(e.target.value) : null)}
                    min="1"
                  />
                </div>
              </div>

              {/* CONTENT */}
              <div className="form-section">
                <h3 className="section-title">Content</h3>
                
                <div className="form-group">
                  <label className="form-label">Short Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.short_desc || ''}
                    onChange={(e) => updateField('short_desc', e.target.value)}
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Long Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.long_desc || ''}
                    onChange={(e) => updateField('long_desc', e.target.value)}
                    rows="5"
                  />
                </div>
              </div>

              {/* MEDIA */}
              <div className="form-section">
                <h3 className="section-title">Media</h3>

                <div className="form-group">
                  <label className="form-label">Upload Images</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ImageUploader
                      slug={formData.slug || 'temp'}
                      label="Upload image"
                      onAdd={(img) => updateField('images', [...(formData.images || []), img.hero])}
                    />
                    <button type="button" className="btn-add" onClick={addGalleryImage}>
                      <Plus className="w-4 h-4" />
                      Add URL
                    </button>
                  </div>
                  {(formData.images || []).length > 0 && (
                    <div className="array-list" style={{ marginTop: '8px' }}>
                      {(formData.images || []).map((url, idx) => (
                        <div key={idx} className="array-item">
                          <input
                            type="url"
                            className="form-input"
                            value={url}
                            onChange={(e) => updateArrayItem('images', idx, e.target.value)}
                            placeholder="Image URL..."
                          />
                          <button
                            type="button"
                            className="btn-icon-small"
                            onClick={() => removeFromArray('images', idx)}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Hover Image</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ImageUploader
                      slug={formData.slug || 'temp'}
                      label="Upload hover"
                      onAdd={(img) => updateField('hover_image', formData.hover_image || img.thumb)}
                    />
                    {formData.hover_image && (
                      <div className="image-preview" style={{ maxWidth: '80px' }}>
                        <img src={formData.hover_image} alt="Hover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: PREVIEW */}
            <div className="preview-panel">
              <div className="preview-controls">
                <div className="preview-tabs">
                  <button
                    type="button"
                    className={`preview-tab ${previewTab === 'card' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('card')}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    className={`preview-tab ${previewTab === 'pdp' ? 'active' : ''}`}
                    onClick={() => setPreviewTab('pdp')}
                  >
                    Bundle Page
                  </button>
                </div>
                
                <div className="view-toggle">
                  <button
                    type="button"
                    className={`view-btn ${viewMode === 'desktop' ? 'active' : ''}`}
                    onClick={() => setViewMode('desktop')}
                    title="Desktop"
                  >
                    <Monitor className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className={`view-btn ${viewMode === 'mobile' ? 'active' : ''}`}
                    onClick={() => setViewMode('mobile')}
                    title="Mobile"
                  >
                    <Smartphone className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="preview-container">
                <div className="preview-wrapper">
                  {previewTab === 'card' ? (
                    <div className="product-card">
                      {formData.images && formData.images[0] ? (
                        <img src={formData.images[0]} alt={formData.name} className="card-image" />
                      ) : (
                        <div className="card-image">No image</div>
                      )}
                      <div className="card-content">
                        <h3 className="card-title">{formData.name || 'Bundle Name'}</h3>
                        {formData.short_desc && (
                          <p className="card-desc">{formData.short_desc}</p>
                        )}
                        <div className="card-price-row">
                          <div className="card-price">{moneyZAR(displayCents)}</div>
                          {isDiscounted && (
                            <>
                              <div className="card-compare-price">{moneyZAR(originalCents)}</div>
                              {discount && (
                                <div className="card-badge">
                                  –{discount.pct}% • save {moneyZAR(discount.amountCents)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pdp-container">
                      {formData.images && formData.images.length > 0 ? (
                        <div className="pdp-gallery">
                          {formData.images.filter(url => url).map((url, idx) => (
                            <div key={idx} className="pdp-thumb">
                              <img src={url} alt={`${formData.name} ${idx + 1}`} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="pdp-gallery">
                          <div className="pdp-thumb">No images</div>
                        </div>
                      )}

                      <h1 className="pdp-title">{formData.name || 'Bundle Name'}</h1>
                      
                      <div className="pdp-price-block">
                        <div className="pdp-price">{moneyZAR(displayCents)}</div>
                        {isDiscounted && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              {moneyZAR(originalCents)}
                            </span>
                            {discount && (
                              <span style={{ color: '#10b981', fontWeight: 700 }}>
                                Save {discount.pct}% • {moneyZAR(discount.amountCents)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ 
                        padding: '8px 16px', 
                        borderRadius: '8px', 
                        background: '#10b98120', 
                        color: '#10b981',
                        fontSize: '14px',
                        fontWeight: 600,
                        marginBottom: '24px',
                        display: 'inline-block'
                      }}>
                        In Stock
                      </div>

                      {formData.short_desc && (
                        <p className="pdp-short-desc">{formData.short_desc}</p>
                      )}

                      {formData.long_desc && (
                        <div className="pdp-section">
                          <h3 className="pdp-section-title">Overview</h3>
                          <p style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                            {formData.long_desc}
                          </p>
                        </div>
                      )}

                      {items.length > 0 && (
                        <div className="pdp-section">
                          <h3 className="pdp-section-title">Bundle Contents</h3>
                          <ul className="pdp-list">
                            {items.map(item => {
                              const product = products.find(p => p.id === item.product_id);
                              return (
                                <li key={item.product_id}>
                                  {item.qty}x {product?.name || 'Unknown Product'}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Item Drawer */}
      <div className="item-drawer-overlay" onClick={() => setShowItemDrawer(false)} />
      <div className="item-drawer">
        <div className="drawer-header">
          <div className="drawer-title">Add Products</div>
          <button
            type="button"
            className="btn-icon-small"
            onClick={() => setShowItemDrawer(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="drawer-search">
          <div className="search-input-wrapper">
            <Search className="search-icon w-5 h-5" />
            <input
              type="text"
              className="search-input"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="drawer-content">
          {/* This now uses the strictly filtered list */}
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="product-list-item"
              onClick={() => addItemToBundle(product)}
            >
              <div className="product-list-name">{product.name}</div>
              <div className="product-list-price">{moneyZAR(product.price_cents)}</div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
             <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
               {searchTerm ? 'No active products found matching search' : 'No active products available'}
             </div>
          )}
        </div>
      </div>
    </>
  );
}