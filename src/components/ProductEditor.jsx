import { useState } from "react";
import { ArrowLeft, Save, Plus, X, Monitor, Smartphone } from "lucide-react";
import { moneyZAR } from "./formatUtils";
import { slugify } from "./helpers";
import PriceDropdown from "./PriceDropdown";
import { useActiveSpecials } from "./hooks/useActiveSpecials";
import { discountLabel } from "./helpers/pricing";
import { useWebhookSender } from "./webhooks/useWebhookSender";
import { ImageUploader } from "@/components/ImageUploader";

export default function ProductEditor({ product, onSave, onCancel, isSaving, title }) {
  // Initialize state with product data, ensuring arrays exist
  const [formData, setFormData] = useState({
    ...product,
    gallery_urls: product.gallery_urls || product.gallery || [], // Handle legacy 'gallery' field name
    hover_image: product.hover_image || product.hover_url || null // Handle legacy field names
  });
  const [previewTab, setPreviewTab] = useState("card");
  const [viewMode, setViewMode] = useState("desktop");

  const { getDisplayPriceCents } = useActiveSpecials();

  // Helper function to clean rich text content
  const cleanRichText = (content) => {
    if (!content) return null;
    
    // If it's an array, check if it has any real content
    if (Array.isArray(content)) {
      return content.length > 0 ? content : null;
    }
    
    // If it's a string, strip HTML tags and check for real content
    if (typeof content === 'string') {
      const stripped = content.replace(/<[^>]*>?/gm, '').trim();
      return stripped.length > 0 ? content : null;
    }
    
    // For other types, return as-is
    return content;
  };

  // Webhook logic
  const webhookData = formData.name ? {
    id: formData.id || formData.slug,
    name: formData.name,
    slug: formData.slug,
    status: formData.status,
    price_cents: formData.price,
    compare_at_price_cents: formData.compare_at_price,
    stock_qty: formData.stock,
    short_description: formData.short_description,
    long_description: formData.long_description, // Note: DB usually maps this to 'overview'
    overview: formData.overview,
    features: formData.features,
    how_to_use: formData.how_to_use,
    ingredients_inci: formData.ingredients_inci || formData.inci_ingredients,
    key_ingredients: formData.key_ingredients,
    claims: formData.claims,
    images: formData.gallery_urls || [],
    hover_image: formData.hover_image,
    variants: formData.variants || [],
    display_price_cents: getDisplayPriceCents('product', formData.id, formData.price)
  } : null;

  useWebhookSender(webhookData, 'product.updated');

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNameBlur = () => {
    if (!formData.slug && formData.name) {
      updateField('slug', slugify(formData.name));
    }
  };

  const addToArray = (field) => {
    const current = formData[field] || [];
    updateField(field, [...current, ""]);
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

  const addVariant = () => {
    const current = formData.variants || [];
    updateField('variants', [...current, { name: "", image: "" }]);
  };

  const updateVariant = (index, field, value) => {
    const current = formData.variants || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    updateField('variants', updated);
  };

  const removeVariant = (index) => {
    const current = formData.variants || [];
    updateField('variants', current.filter((_, i) => i !== index));
  };

  const addGalleryImage = () => {
    const current = formData.gallery_urls || [];
    updateField('gallery_urls', [...current, ""]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
     
    // Clean the data before sending to Supabase
    const productData = {
      ...formData,
      
      // 1. Clean up "Ghost Data" so empty fields become real NULLs
      description: cleanRichText(formData.description),
      how_to_use: cleanRichText(formData.how_to_use),
      shelf_life: cleanRichText(formData.shelf_life),
      storage: cleanRichText(formData.storage),
      
      // 2. Ensure Ingredients is ALWAYS saved as a proper List (Array)
      ingredients: {
        inci: typeof formData.ingredients === 'string'
          ? formData.ingredients.split(',').map(i => i.trim()).filter(Boolean)
          : (formData.ingredients?.inci || [])
      }
    };
 
    // Ensure ingredients.inci is always an array
    if (!Array.isArray(productData.ingredients.inci)) {
      productData.ingredients.inci = [];
    }
 
    // await supabase.from('products').upsert(productData)...
    // Ensure we pass consistent field names back to parent
    onSave(productData);
  };

  const baseCents = formData.price || 0;
  const compareCents = formData.compare_at_price;
  const displayCents = getDisplayPriceCents('product', formData.id, baseCents);
  const originalCents = Math.max(compareCents || 0, baseCents);
  const isDiscounted = displayCents < originalCents;
  const discount = isDiscounted ? discountLabel(originalCents, displayCents) : null;

  const containerWidth = viewMode === "mobile" ? "375px" : "100%";

  // Helper handlers for array buttons
  const handleAddFeatures = () => addToArray('features');
  const handleAddHowToUse = () => addToArray('how_to_use');
  const handleAddIngredients = () => addToArray('inci_ingredients'); // Mapped to DB column usually
  const handleAddKeyIngredients = () => addToArray('key_ingredients');
  const handleAddClaims = () => addToArray('claims');

  return (
    <>
      <style>{`
        .editor-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        .editor-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }

        .btn-back {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .btn-back:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .editor-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          flex: 1;
        }

        .btn-save {
          padding: 12px 28px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: transform 0.2s;
        }

        .btn-save:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-save:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .editor-grid {
          display: grid;
          grid-template-columns: 500px 1fr;
          gap: 32px;
        }

        @media (max-width: 1200px) {
          .editor-grid {
            grid-template-columns: 1fr;
          }
        }

        .form-panel {
          background: var(--card);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          min-height: calc(100vh - 110px);
          overflow: visible;
        }

        .form-section {
          margin-bottom: 32px;
          padding-bottom: 32px;
          border-bottom: 2px solid var(--border);
        }

        .form-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .section-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-group {
          margin-bottom: 20px;
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

        .form-input, .form-textarea, .form-select {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
          transition: box-shadow 0.2s;
        }

        .form-input:focus, .form-textarea:focus, .form-select:focus {
          outline: none;
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
        }

        .form-textarea {
          min-height: 100px;
          resize: vertical;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .array-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .array-item {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn-icon-small {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: none;
          background: var(--card);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
          flex-shrink: 0;
        }

        .btn-icon-small:hover {
          color: var(--text);
        }

        .btn-icon-small:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .btn-add {
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          margin-top: 8px;
        }

        .btn-add:hover {
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .preview-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .preview-controls {
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .preview-tabs {
          display: flex;
          gap: 8px;
        }

        .preview-tab {
          padding: 10px 20px;
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

        .preview-tab.active {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.3);
        }

        .view-toggle {
          display: flex;
          gap: 8px;
        }

        .view-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
        }

        .view-btn.active {
          color: var(--accent);
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .preview-container {
          background: var(--card);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          display: flex;
          justify-content: center;
        }

        .preview-wrapper {
          width: ${containerWidth};
          max-width: 100%;
        }

        .product-card {
          background: var(--bg);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .card-image {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          background: linear-gradient(135deg, rgba(110, 193, 255, 0.1), rgba(255, 119, 233, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 14px;
        }

        .card-content {
          padding: 20px;
        }

        .card-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }
        
        .card-desc {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 12px;
          line-height: 1.5;
        }

        .card-price-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .card-price {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .card-compare-price {
          font-size: 16px;
          color: var(--text-muted);
          text-decoration: line-through;
        }

        .card-badge {
          padding: 4px 12px;
          border-radius: 8px;
          background: #10b98120;
          color: #10b981;
          font-size: 12px;
          font-weight: 700;
        }

        .pdp-container {
          font-size: ${viewMode === "mobile" ? "14px" : "16px"};
        }

        .pdp-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .pdp-thumb {
          aspect-ratio: 1;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(110, 193, 255, 0.1), rgba(255, 119, 233, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: var(--text-muted);
          overflow: hidden;
        }

        .pdp-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pdp-title {
          font-size: ${viewMode === "mobile" ? "20px" : "28px"};
          font-weight: 700;
          color: var(--text);
          margin-bottom: 16px;
        }

        .pdp-price-block {
          margin-bottom: 20px;
        }

        .pdp-price {
          font-size: ${viewMode === "mobile" ? "28px" : "36px"};
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .pdp-short-desc {
          color: var(--text-muted);
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .pdp-tabs {
          border-bottom: 2px solid var(--border);
          margin-bottom: 20px;
          display: flex;
          gap: 24px;
        }

        .pdp-tab {
          padding: 12px 0;
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: ${viewMode === "mobile" ? "13px" : "14px"};
          font-weight: 600;
          cursor: pointer;
          position: relative;
        }

        .pdp-tab.active {
          color: var(--text);
        }

        .pdp-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
        }

        .pdp-section {
          margin-bottom: 24px;
        }

        .pdp-section-title {
          font-size: ${viewMode === "mobile" ? "16px" : "18px"};
          font-weight: 700;
          color: var(--text);
          margin-bottom: 12px;
        }

        .pdp-list {
          list-style: none;
          padding: 0;
        }

        .pdp-list li {
          padding: 8px 0;
          padding-left: 24px;
          position: relative;
          color: var(--text);
          line-height: 1.6;
        }

        .pdp-list li::before {
          content: '•';
          position: absolute;
          left: 8px;
          color: var(--accent);
          font-weight: 700;
        }

        .pdp-claims {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pdp-claim {
          padding: 6px 14px;
          border-radius: 10px;
          background: var(--card);
          color: var(--text);
          font-size: ${viewMode === "mobile" ? "11px" : "12px"};
          font-weight: 600;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .image-preview {
          width: 100%;
          max-width: 200px;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          margin-top: 8px;
          background: linear-gradient(135deg, rgba(110, 193, 255, 0.1), rgba(255, 119, 233, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--text-muted);
        }

        .image-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .variant-card {
          padding: 16px;
          border-radius: 12px;
          background: var(--bg);
          margin-bottom: 12px;
        }

        .variant-grid {
          display: grid;
          grid-template-columns: 2fr 1.2fr auto;
          gap: 16px;
          align-items: start;
        }

        .variant-name-input {
          min-width: 200px;
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
            {isSaving ? 'Saving...' : 'Save Product'}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="editor-grid">
            <div className="form-panel">
              
              {/* CORE INFO */}
              <div className="form-section">
                <h3 className="section-title">Core Details</h3>
                <div className="form-group">
                  <label className="form-label">Product Name</label>
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
                    <label className="form-label">SKU</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.sku || ''}
                      onChange={(e) => updateField('sku', e.target.value)}
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
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

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
              </div>

              {/* PRICING */}
              <div className="form-section">
                <h3 className="section-title">Pricing</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Price (R)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.price}
                      onChange={(e) => updateField('price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price (R)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.cost_price_cents ? (formData.cost_price_cents / 100).toFixed(2) : ''}
                      onChange={(e) => updateField('cost_price_cents', e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Compare At (R)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.compare_at_price || ''}
                    onChange={(e) => updateField('compare_at_price', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
                <PriceDropdown
                  currentPrice={formData.price}
                  comparePrice={formData.compare_at_price}
                  onPriceChange={(newPrice) => updateField('price', newPrice)}
                />
              </div>

              {/* MEDIA - WITH HOVER IMAGE UPLOADER */}
              <div className="form-section">
                <h3 className="section-title">Media</h3>
                
                <div className="form-grid">
                  {/* MAIN IMAGE */}
                  <div className="form-group">
                    <label className="form-label">Main Image</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <ImageUploader
                        slug={formData.slug || 'temp'}
                        label="Upload Main"
                        onAdd={(img) => updateField('thumbnail_url', img.url)} // Using 'url' from Cloudinary response which is secure_url
                      />
                      {formData.thumbnail_url && (
                        <div className="image-preview">
                          <img src={formData.thumbnail_url} alt="Main" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* HOVER IMAGE */}
                  <div className="form-group">
                    <label className="form-label">Hover / Flip Image</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <ImageUploader
                        slug={formData.slug || 'temp'}
                        label="Upload Hover"
                        onAdd={(img) => updateField('hover_image', img.url)}
                      />
                      {formData.hover_image ? (
                        <div className="image-preview">
                          <img src={formData.hover_image} alt="Hover" />
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No hover image
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* GALLERY */}
                <div className="form-group">
                  <label className="form-label">Gallery Images</label>
                  <div className="array-list">
                    {(formData.gallery_urls || []).map((url, idx) => (
                      <div key={idx} className="array-item">
                        <input
                          type="text"
                          className="form-input"
                          value={url}
                          onChange={(e) => updateArrayItem('gallery_urls', idx, e.target.value)}
                          placeholder="Image URL..."
                        />
                        <button
                          type="button"
                          className="btn-icon-small"
                          onClick={() => removeFromArray('gallery_urls', idx)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button type="button" className="btn-add" onClick={addGalleryImage}>
                      <Plus size={14} /> Add URL Manually
                    </button>
                    <ImageUploader
                      slug={formData.slug || 'temp'}
                      label="Upload to Gallery"
                      onAdd={(img) => updateField('gallery_urls', [...(formData.gallery_urls || []), img.url])}
                    />
                  </div>
                  
                  {formData.gallery_urls && formData.gallery_urls.length > 0 && (
                    <div className="gallery-grid">
                      {formData.gallery_urls.filter(url => url).map((url, idx) => (
                        <div key={idx} className="image-preview">
                          <img src={url} alt={`Gallery ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CONTENT */}
              <div className="form-section">
                <h3 className="section-title">Details</h3>
                <div className="form-group">
                  <label className="form-label">Short Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.short_description || ''}
                    onChange={(e) => updateField('short_description', e.target.value)}
                    rows="2"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Overview / Long Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.overview || formData.long_description || ''}
                    onChange={(e) => updateField('overview', e.target.value)}
                    rows="4"
                  />
                </div>
                
                {/* Arrays */}
                <div className="form-group">
                  <label className="form-label">Features</label>
                  {(formData.features || []).map((f, i) => (
                    <div key={i} className="array-item">
                      <input className="form-input" value={f} onChange={e => updateArrayItem('features', i, e.target.value)} />
                      <button type="button" className="btn-icon-small" onClick={() => removeFromArray('features', i)}><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn-add" onClick={handleAddFeatures}><Plus size={14}/> Add Feature</button>
                </div>
                
                <div className="form-group">
                  <label className="form-label">How To Use</label>
                  {(formData.how_to_use || []).map((f, i) => (
                    <div key={i} className="array-item">
                      <input className="form-input" value={f} onChange={e => updateArrayItem('how_to_use', i, e.target.value)} />
                      <button type="button" className="btn-icon-small" onClick={() => removeFromArray('how_to_use', i)}><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn-add" onClick={handleAddHowToUse}><Plus size={14}/> Add Step</button>
                </div>

                <div className="form-group">
                  <label className="form-label">Ingredients (INCI)</label>
                  {(formData.ingredients_inci || formData.inci_ingredients || []).map((f, i) => (
                    <div key={i} className="array-item">
                      <input className="form-input" value={f} onChange={e => updateArrayItem('inci_ingredients', i, e.target.value)} />
                      <button type="button" className="btn-icon-small" onClick={() => removeFromArray('inci_ingredients', i)}><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn-add" onClick={handleAddIngredients}><Plus size={14}/> Add Ingredient</button>
                </div>

                <div className="form-group">
                  <label className="form-label">Key Ingredients</label>
                  {(formData.key_ingredients || []).map((f, i) => (
                    <div key={i} className="array-item">
                      <input className="form-input" value={f} onChange={e => updateArrayItem('key_ingredients', i, e.target.value)} />
                      <button type="button" className="btn-icon-small" onClick={() => removeFromArray('key_ingredients', i)}><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn-add" onClick={handleAddKeyIngredients}><Plus size={14}/> Add Key Ingredient</button>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Claims</label>
                  {(formData.claims || []).map((f, i) => (
                    <div key={i} className="array-item">
                      <input className="form-input" value={f} onChange={e => updateArrayItem('claims', i, e.target.value)} />
                      <button type="button" className="btn-icon-small" onClick={() => removeFromArray('claims', i)}><X size={14} /></button>
                    </div>
                  ))}
                  <button type="button" className="btn-add" onClick={handleAddClaims}><Plus size={14}/> Add Claim</button>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Size</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.size || ''}
                      onChange={(e) => updateField('size', e.target.value)}
                      placeholder="e.g., 50ml"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Shelf Life</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.shelf_life || ''}
                      onChange={(e) => updateField('shelf_life', e.target.value)}
                      placeholder="e.g., 24 months"
                    />
                  </div>
                </div>
              </div>

              {/* VARIANTS */}
              <div className="form-section">
                <h3 className="section-title">Variants</h3>
                
                {(formData.variants || []).map((variant, idx) => (
                  <div key={idx} className="variant-card">
                    <div className="variant-grid">
                      <input
                        type="text"
                        className="form-input variant-name-input"
                        value={variant.name}
                        onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                        placeholder="Variant name..."
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ImageUploader
                          slug={formData.slug || 'temp'}
                          label="Image"
                          onAdd={(img) => updateVariant(idx, 'image', img.url)}
                        />
                        {variant.image && (
                          <div className="image-preview" style={{ maxWidth: '64px' }}>
                            <img src={variant.image} alt="Variant" />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-icon-small"
                        onClick={() => removeVariant(idx)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                
                <button type="button" className="btn-add" onClick={addVariant}>
                  <Plus size={14} />
                  Add Variant
                </button>
              </div>

              {/* INVENTORY */}
              <div className="form-section">
                <h3 className="section-title">Stock Status</h3>

                <div className="form-group">
                  <button
                    type="button"
                    onClick={() => updateField('out_of_stock', !formData.out_of_stock)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 20px',
                      borderRadius: '10px',
                      border: `2px solid ${formData.out_of_stock ? '#ef4444' : '#10b981'}`,
                      background: formData.out_of_stock ? '#fef2f2' : '#f0fdf4',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: formData.out_of_stock ? '#ef4444' : '#10b981',
                      flexShrink: 0,
                    }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: formData.out_of_stock ? '#dc2626' : '#059669' }}>
                        {formData.out_of_stock ? 'Out of Stock' : 'In Stock'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        {formData.out_of_stock
                          ? 'Add to Cart is disabled on the website. Click to mark as In Stock.'
                          : 'Customers can add this product to cart. Click to mark as Out of Stock.'}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* PREVIEW PANEL */}
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
                    Product Page
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
                    <div className="product-card" style={{ width: '100%', maxWidth: 300, margin: '0 auto' }}>
                      <div style={{ position: 'relative', aspectRatio: '1/1', overflow: 'hidden' }}>
                        {formData.thumbnail_url ? (
                          <img src={formData.thumbnail_url} alt={formData.name} className="card-image" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
                        ) : (
                          <div className="card-image">No image</div>
                        )}
                        {formData.hover_image && (
                          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                            Hover Image Set
                          </div>
                        )}
                      </div>
                      <div className="card-content">
                        <h3 className="card-title">{formData.name || 'Product Name'}</h3>
                        {formData.short_description && (
                          <p className="card-desc">{formData.short_description}</p>
                        )}
                        <div className="card-price-row">
                          <div className="card-price">{moneyZAR(displayCents)}</div>
                          {isDiscounted && (
                            <>
                              <div className="card-compare-price">{moneyZAR(originalCents)}</div>
                              {discount && (
                                <div className="card-badge">
                                  –{discount.pct}%
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="pdp-container">
                      {formData.gallery_urls && formData.gallery_urls.length > 0 ? (
                        <div className="pdp-gallery">
                          {formData.gallery_urls.filter(url => url).map((url, idx) => (
                            <div key={idx} className="pdp-thumb">
                              <img src={url} alt={`${formData.name} ${idx + 1}`} />
                            </div>
                          ))}
                        </div>
                      ) : formData.thumbnail_url ? (
                        <div className="pdp-gallery">
                          <div className="pdp-thumb">
                            <img src={formData.thumbnail_url} alt={formData.name} />
                          </div>
                        </div>
                      ) : (
                        <div className="pdp-gallery">
                          <div className="pdp-thumb">No images</div>
                        </div>
                      )}

                      <h1 className="pdp-title">{formData.name || 'Product Name'}</h1>
                      
                      <div className="pdp-price-block">
                        <div className="pdp-price">{moneyZAR(displayCents)}</div>
                        {isDiscounted && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                              {moneyZAR(originalCents)}
                            </span>
                            {discount && (
                              <span style={{ color: '#10b981', fontWeight: 700 }}>
                                –{discount.pct}% • save {moneyZAR(discount.amountCents)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {formData.short_description && (
                        <p className="pdp-short-desc">{formData.short_description}</p>
                      )}

                      <div className="pdp-tabs">
                        <button type="button" className="pdp-tab active">Overview</button>
                        <button type="button" className="pdp-tab">How to Use</button>
                        <button type="button" className="pdp-tab">Ingredients</button>
                      </div>

                      {formData.overview && (
                        <div className="pdp-section">
                          <p style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                            {formData.overview}
                          </p>
                        </div>
                      )}

                      {formData.features && formData.features.filter(f => f).length > 0 && (
                        <div className="pdp-section">
                          <h3 className="pdp-section-title">Features</h3>
                          <ul className="pdp-list">
                            {formData.features.filter(f => f).map((feature, idx) => (
                              <li key={idx}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {formData.claims && formData.claims.filter(c => c).length > 0 && (
                        <div className="pdp-section">
                          <h3 className="pdp-section-title">Claims</h3>
                          <div className="pdp-claims">
                            {formData.claims.filter(c => c).map((claim, idx) => (
                              <span key={idx} className="pdp-claim">{claim}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {formData.size && (
                        <div className="pdp-section">
                          <h3 className="pdp-section-title">Size</h3>
                          <p style={{ color: 'var(--text)' }}>{formData.size}</p>
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
    </>
  );
}
