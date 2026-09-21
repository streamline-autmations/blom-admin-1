import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react"; // Added Search icon
import ProductCard from "../components/ProductCard";
import { ProductPageTemplate } from "../../ProductPageTemplate";
import { useToast } from "../components/ui/ToastProvider";
import { supabase } from "../components/supabaseClient";
import { uploadToCloudinary } from "../lib/cloudinary";
import { createPageUrl } from "../utils";

// ... existing helper functions (slugify, ensureList, etc) ...
const slugify = (value) =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const ensureList = (value) => {
  if (Array.isArray(value) && value.length > 0) return value;
  return [""];
};

// ... initialFormState ...
const initialFormState = {
  name: '',
  product_type: 'bundle', // Default to 'bundle' as requested
  price: '',
  compare_at_price: '',
  short_description: '',
  overview: '',
  thumbnail_url: '',
  hover_url: '',
  gallery_urls: [''],
  features: [''],
  how_to_use: [''],
  status: 'active',
  is_featured: false,
  badges: [''],
  bundle_products: [{ product_id: '', variant_id: '', quantity: 1 }],
};

export default function BundleNew() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [previewTab, setPreviewTab] = useState("card");
  const [viewMode, setViewMode] = useState("desktop");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState(""); // NEW: Search state
  const [fullscreenPreview, setFullscreenPreview] = useState(false);

  // UPDATED: Load ALL products with strict status filtering and pagination handling
  useEffect(() => {
    async function loadAllProducts() {
      let allData = [];
      let from = 0;
      let limit = 1000;
      let keepFetching = true;

      try {
        while (keepFetching) {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, price, price_cents, variants, status') // Added status and price_cents
            .eq('is_active', true)
            .eq('status', 'active') // FIX: Only show strictly active products
            .order('name')
            .range(from, from + limit - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += limit;
            // If we got less than the limit, we've reached the end
            if (data.length < limit) keepFetching = false;
          } else {
            keepFetching = false;
          }
        }
        
        console.log(`Loaded ${allData.length} products`);
        setAllProducts(allData);
      } catch (error) {
        console.error("Error loading products:", error);
        showToast("error", "Failed to load complete product list");
      }
    }
    loadAllProducts();
  }, []);

  // NEW: Filter products based on search term
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm) return allProducts;
    const lowerTerm = productSearchTerm.toLowerCase();
    
    return allProducts.filter(product => 
      product.name.toLowerCase().includes(lowerTerm) || 
      (product.variants && JSON.stringify(product.variants).toLowerCase().includes(lowerTerm))
    );
  }, [allProducts, productSearchTerm]);

  // ... existing calculateComparePrice useEffect ...
  useEffect(() => {
    const calculateComparePrice = async () => {
      if (!form.bundle_products || form.bundle_products.length === 0) {
        setForm(prev => ({ ...prev, compare_at_price: '0.00' }));
        return;
      }

      const productIds = form.bundle_products
        .map(bp => bp.product_id)
        .filter(Boolean);

      if (productIds.length === 0) {
        setForm(prev => ({ ...prev, compare_at_price: '0.00' }));
        return;
      }

      // Use local state instead of re-fetching for speed
      try {
        const total = form.bundle_products.reduce((acc, item) => {
          const product = allProducts.find(p => p.id === item.product_id);
          if (!product) return acc;
          
          // Robust price check
          const price = product.price || (product.price_cents ? product.price_cents / 100 : 0);
          const quantity = parseInt(item.quantity) || 0;
          return acc + (price * quantity);
        }, 0);

        setForm(prev => ({ ...prev, compare_at_price: total.toFixed(2) }));
      } catch (error) {
        console.error('Error calculating compare price:', error);
      }
    };

    calculateComparePrice();
  }, [form.bundle_products, allProducts]);

  // ... existing update functions (update, updateArr, addRow, removeRow) ...
  const update = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const getArrayFromPrevious = (previous, field) => {
    const current = previous[field];
    if (Array.isArray(current) && current.length > 0) {
      return [...current];
    }
    return [""];
  };

  const updateArr = (field, index, value) => {
    setForm((previous) => {
      const next = getArrayFromPrevious(previous, field);
      next[index] = value;
      return { ...previous, [field]: next };
    });
  };

  const addRow = (field) => {
    setForm((previous) => {
      const next = getArrayFromPrevious(previous, field);
      next.push("");
      return { ...previous, [field]: next };
    });
  };

  const removeRow = (field, index) => {
    setForm((previous) => {
      const next = getArrayFromPrevious(previous, field);
      next.splice(index, 1);
      return { ...previous, [field]: next.length ? next : [""] };
    });
  };

  // ... existing useMemos (priceNumber, compareAtNumber, etc) ...
  const priceNumber = useMemo(() => {
    const parsed = parseFloat(form.price);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [form.price]);

  const compareAtNumber = useMemo(() => {
    const parsed = parseFloat(form.compare_at_price);
    return Number.isFinite(parsed) ? parsed : null;
  }, [form.compare_at_price]);

  const features = useMemo(
    () => ensureList(form.features).map((item) => item.trim()).filter(Boolean),
    [form.features]
  );

  const howToUse = useMemo(
    () => ensureList(form.how_to_use).map((item) => item.trim()).filter(Boolean),
    [form.how_to_use]
  );

  const images = useMemo(() => {
    const primary = form.thumbnail_url?.trim();
    const galleryUrls = ensureList(form.gallery_urls).map((url) => url.trim()).filter(Boolean);
    // Exclude hover_url from the main images list as requested
    // const hover = form.hover_url?.trim();
    const list = [primary, ...galleryUrls].filter(Boolean);
    // Deduplicate images
    return [...new Set(list)];
  }, [form.thumbnail_url, form.gallery_urls]);

  const previewImages = useMemo(
    () => (images.length ? images : ["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23f0f0f0' width='800' height='800'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='24' font-family='system-ui'%3ENo Image%3C/text%3E%3C/svg%3E"]),
    [images]
  );

  const stockLabel = useMemo(() => {
    if (form.status === "archived") return "Archived";
    return "In Stock";
  }, [form.status]);

  const priceString = useMemo(() => {
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) return "R0";
    return `R${Math.round(priceNumber)}`;
  }, [priceNumber]);

  const cardModel = useMemo(
    () => ({
      id: "new-bundle-preview",
      name: form.name || "New Bundle",
      slug: "new-bundle",
      price_cents: Number.isFinite(priceNumber) ? Math.round(priceNumber * 100) : 0,
      compare_at_price_cents: compareAtNumber ? Math.round(compareAtNumber * 100) : undefined,
      short_desc: form.short_description || "",
      images: previewImages,
      stock_qty: form.status !== "archived" ? 1 : 0,
      badges: [],
    }),
    [form.name, form.short_description, form.status, previewImages, priceNumber, compareAtNumber]
  );

  const pageModel = useMemo(
    () => ({
      name: form.name || "New Bundle",
      slug: "new-bundle",
      category: form.product_type === 'bundle' ? 'Bundle Deals' : 'Collections',
      shortDescription: form.short_description || "",
      overview: form.overview || "",
      price: priceString,
      compareAtPrice: compareAtNumber ? `R${Math.round(compareAtNumber)}` : undefined,
      stock: stockLabel,
      images: previewImages,
      features,
      howToUse,
      ingredients: { inci: [], key: [] },
      details: { size: "", shelfLife: "", claims: [] },
      variants: [],
      related: [],
      rating: 4.8,
      reviewCount: 124,
      reviews: [],
      seo: {
        title: form.name || "",
        description: form.short_description
          ? `${form.short_description.substring(0, 150)}...`
          : `Buy ${form.name} bundle online at BLOM Cosmetics`,
      },
    }),
    [
      compareAtNumber,
      features,
      form.name,
      form.overview,
      form.product_type,
      form.short_description,
      howToUse,
      previewImages,
      priceString,
      stockLabel,
    ]
  );

  // ... validate function ...
  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      nextErrors.price = "Price must be greater than 0";
    }
    // Images are optional
    // if (images.length === 0) {
    //   nextErrors.images = "Add at least one product image";
    // }
    if (form.bundle_products.length === 0 || !form.bundle_products.some(bp => bp.product_id)) {
      nextErrors.bundle_products = "Add at least one product to the bundle";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // ... handleSubmit function ...
  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError("");

    if (!validate()) {
      showToast("error", "Please fix the highlighted fields");
      return;
    }

    // Generate Slug if not exists (although we don't have a slug field in UI yet, we should add one or generate it)
    const slug = slugify(form.name);
    const sku = `BUN-${Date.now().toString().slice(-6)}`;

    const payload = {
      name: form.name.trim(),
      slug: slug, // Added generated slug
      sku: sku, // Added generated SKU
      category: 'Bundle Deals',
      product_type: 'bundle', // Force to 'bundle' and ignore form.product_type
      status: form.status,
      price: Number.isFinite(priceNumber) ? priceNumber : 0,
      compare_at_price: Number.isFinite(compareAtNumber ?? Number.NaN) ? compareAtNumber : null,
      short_description: form.short_description,
      overview: form.overview || form.short_description,
      description: form.overview || form.short_description,
      thumbnail_url: form.thumbnail_url?.trim() || "",
      hover_url: form.hover_url?.trim() || "",
      gallery_urls: ensureList(form.gallery_urls).map((url) => url.trim()).filter(Boolean),
      variants: [],
      features,
      how_to_use: howToUse,
      inci_ingredients: [],
      key_ingredients: [],
      size: "",
      shelf_life: "",
      claims: [],
      is_active: true,
      is_featured: Boolean(form.is_featured),
      badges: ensureList(form.badges).map((item) => item.trim()).filter(Boolean),
      related: [],
      stock_label: stockLabel,
      price_string: priceString,
      images: previewImages,
      bundle_products: form.bundle_products.filter(b => b.product_id),
    };

    try {
      setIsSubmitting(true);
      const response = await fetch("/.netlify/functions/save-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result?.ok === false) {
        const message = result?.error || result?.message || "Failed to create bundle";
        setServerError(message);
        showToast("error", message);
        return;
      }

      showToast("success", "Bundle created successfully!");
      navigate(createPageUrl("Bundles"));
    } catch (error) {
      const message = error?.message || "Failed to create bundle";
      setServerError(message);
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... renderArrayField function ...
  const renderArrayField = (field, label, placeholder, addLabel, errorKey) => {
    const items = ensureList(form[field]);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-[var(--text)]">{label}</label>
          {errorKey && errors[errorKey] ? (
            <span className="text-xs font-medium text-red-500">{errors[errorKey]}</span>
          ) : null}
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${field}-${index}`} className="flex gap-2">
              <input
                type="text"
                className="product-form-input flex-1"
                value={item}
                placeholder={placeholder}
                onChange={(event) => updateArr(field, index, event.target.value)}
              />
              <button
                type="button"
                onClick={() => removeRow(field, index)}
                className="product-btn-secondary"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => addRow(field)}
          className="product-btn-add"
        >
          + {addLabel}
        </button>
      </div>
    );
  };

  const textareaClass = (hasError) => `product-form-textarea${hasError ? " border-red-500 focus:ring-rose-500" : ""}`;

  return (
    <>
      <style>{`
        /* ... existing styles ... */
        .form-topbar {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 24px 32px;
          border-bottom: 2px solid var(--border);
          background: var(--card);
          margin-bottom: 24px;
        }
        .form-content-area {
          padding: 0 32px 32px;
          overflow-y: auto;
        }
        .product-form-input, .product-form-textarea, .product-form-select {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
          transition: box-shadow .2s;
        }
        .product-form-input:focus, .product-form-textarea:focus, .product-form-select:focus {
          outline: none;
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
        }
        .product-form-textarea {
          min-height: 100px;
          resize: vertical;
          position: relative;
          z-index: 1;
        }
        .product-form-section {
          background: var(--card);
          border-radius: 20px;
          padding: 32px;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          margin-bottom: 24px;
        }
        .product-section-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }
        .product-section-desc {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 20px;
        }
        .product-form-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: .05em;
        }
        .product-btn-primary {
          padding: 12px 28px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: transform 0.2s;
        }
        .product-btn-primary:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .product-btn-primary:not(:disabled):hover {
          transform: translateY(-2px);
        }
        .product-btn-secondary {
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }
        .product-btn-secondary:hover {
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }
        .product-btn-secondary:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }
        .product-btn-add {
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
        .product-btn-add:hover {
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }
        .bundle-product-row {
          display: grid;
          grid-template-columns: 1fr 1fr 100px 44px;
          gap: 1rem;
          margin-bottom: 1rem;
          align-items: center;
        }
        .bundle-product-row:has(.product-form-select:nth-child(2):last-child) {
          grid-template-columns: 1fr 100px 44px;
        }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        .grid { display: grid; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        .flex { display: flex; }
        .flex-1 { flex: 1 1 0%; }
        .hidden { display: none; }
        .cursor-pointer { cursor: pointer; }
        @media (min-width: 768px) {
          .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (min-width: 1280px) {
          .xl\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        .preview-fullscreen {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: white;
          z-index: 9999;
          overflow-y: auto;
          padding: 0;
        }
        .preview-fullscreen .desktop-preview { max-width: 1200px; margin: 0 auto; }
        .preview-fullscreen .mobile-preview { max-width: 375px; margin: 0 auto; }
      `}</style>
      <div className="flex h-full flex-col">
        <div className="form-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => navigate(createPageUrl("Bundles"))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '36px', height: '36px', borderRadius: '8px',
                border: 'none', background: 'var(--bg)',
                boxShadow: '2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light)',
                cursor: 'pointer', transition: 'transform 0.2s'
              }}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text)' }} />
            </button>
            <div className="font-bold text-lg">New Bundle</div>
          </div>
          <div className="text-sm text-[var(--text-muted)]">Create a new bundle and preview the merchandising experience.</div>
        </div>

        <div className="form-content-area grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* ... mobile styles ... */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <section className="product-form-section">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">Basic Information</h2>
                <p className="text-sm text-[var(--text-muted)]">Name and classification for the bundle.</p>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[var(--text)]" htmlFor="name">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    className="product-form-input"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="e.g. Petal Collection or Prep & Primer Bundle"
                  />
                  {errors.name ? <p className="text-xs text-red-500">{errors.name}</p> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[var(--text)]" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    className="product-form-select"
                    value={form.status}
                    onChange={(event) => update("status", event.target.value)}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                {renderArrayField("badges", "Badges", "e.g. Best Value", "Add badge")}
              </div>
            </section>

            <section className="product-form-section">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">Bundle Products *</h2>
                <p className="text-sm text-[var(--text-muted)]">Select products included in this bundle</p>
              </header>

              {/* NEW: Product Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    className="product-form-input pl-10"
                    placeholder="Search for a product to add..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                </div>
                <small className="text-xs text-[var(--text-muted)] mt-1 block">
                  Showing {filteredProducts.length} of {allProducts.length} products
                </small>
              </div>

              {form.bundle_products.map((item, index) => {
                const selectedProduct = allProducts.find(p => p.id === item.product_id);
                const productVariants = selectedProduct?.variants || [];
                const hasVariants = productVariants.length > 0;
                
                return (
                  <div key={index} className="bundle-product-row">
                    <select
                      value={item.product_id}
                      onChange={(e) => {
                        const updated = [...form.bundle_products];
                        updated[index] = { ...updated[index], product_id: e.target.value, variant_id: '' };
                        setForm(prev => ({ ...prev, bundle_products: updated }));
                      }}
                      className="product-form-select"
                      required
                    >
                      <option value="">Select product...</option>
                      {/* Using filteredProducts ensures we can see what we searched for */}
                      {/* But we also need to ensure the CURRENTLY selected product is always visible even if not in search criteria */}
                      {(productSearchTerm ? filteredProducts : allProducts).concat(
                        (selectedProduct && productSearchTerm && !filteredProducts.find(p => p.id === selectedProduct.id)) 
                          ? [selectedProduct] 
                          : []
                      ).map(product => {
                        const displayPrice = product.price || (product.price_cents ? product.price_cents / 100 : 0);
                        return (
                          <option key={product.id} value={product.id}>
                            {product.name} - R{displayPrice}
                          </option>
                        );
                      })}
                    </select>

                    {hasVariants && (
                      <select
                        value={item.variant_id}
                        onChange={(e) => {
                          const updated = [...form.bundle_products];
                          updated[index] = { ...updated[index], variant_id: e.target.value };
                          setForm(prev => ({ ...prev, bundle_products: updated }));
                        }}
                        className="product-form-select"
                        required
                      >
                        <option value="">Select variant...</option>
                        {productVariants.map((variant, vIndex) => {
                          const variantName = typeof variant === 'string' ? variant : variant.name || variant.label;
                          return (
                            <option key={vIndex} value={vIndex}>
                              {variantName}
                            </option>
                          );
                        })}
                      </select>
                    )}

                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...form.bundle_products];
                        updated[index] = { ...updated[index], quantity: parseInt(e.target.value) || 1 };
                        setForm(prev => ({ ...prev, bundle_products: updated }));
                      }}
                      className="product-form-input"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (form.bundle_products.length > 1) {
                          const updated = form.bundle_products.filter((_, i) => i !== index);
                          setForm(prev => ({ ...prev, bundle_products: updated }));
                        }
                      }}
                      disabled={form.bundle_products.length === 1}
                      className="product-btn-secondary"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setForm(prev => ({
                  ...prev,
                  bundle_products: [...prev.bundle_products, { product_id: '', variant_id: '', quantity: 1 }]
                }))}
                className="btn-add product-btn-add"
              >
                + Add Product
              </button>
              {errors.bundle_products ? (
                <p className="text-xs text-red-500 mt-2">{errors.bundle_products}</p>
              ) : null}
            </section>

            {/* ... rest of the sections (Pricing, Descriptions, Images, Features, Buttons) ... */}
            <section className="product-form-section">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">Pricing</h2>
                <p className="text-sm text-[var(--text-muted)]">Set bundle pricing. Stock is automatically calculated from components.</p>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[var(--text)]" htmlFor="price">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="product-form-input"
                    value={form.price}
                    onChange={(event) => update("price", event.target.value)}
                    placeholder="199"
                  />
                  {errors.price ? <p className="text-xs text-red-500">{errors.price}</p> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[var(--text)]" htmlFor="compare_at_price">
                    Compare at Price
                  </label>
                  <input
                    id="compare_at_price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="product-form-input"
                    value={form.compare_at_price}
                    onChange={(event) => update("compare_at_price", event.target.value)}
                    placeholder="249"
                    readOnly
                  />
                  <small className="text-xs text-[var(--text-muted)]">Auto-calculated from bundle components</small>
                </div>
              </div>
            </section>

            <section className="product-form-section">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">Descriptions</h2>
                <p className="text-sm text-[var(--text-muted)]">Short copy for cards and the full overview.</p>
              </header>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[var(--text)]" htmlFor="short_description">
                    Short Description
                  </label>
                  <textarea
                    id="short_description"
                    className={textareaClass(false)}
                    rows={3}
                    value={form.short_description}
                    onChange={(event) => update("short_description", event.target.value)}
                    placeholder="A complete nail care bundle with everything you need."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[var(--text)]" htmlFor="overview">
                    Overview
                  </label>
                  <textarea
                    id="overview"
                    className={textareaClass(false)}
                    rows={6}
                    value={form.overview}
                    onChange={(event) => update("overview", event.target.value)}
                    placeholder="Detailed bundle description, usage story and benefits."
                  />
                </div>
              </div>
            </section>

            <section className="product-form-section">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">Images</h2>
                <p className="text-sm text-[var(--text-muted)]">Main product image and optional hover image.</p>
              </header>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-[var(--text)]" htmlFor="thumbnail_url">
                    Main Product Image URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="thumbnail_url"
                      type="url"
                      className="product-form-input flex-1"
                      value={form.thumbnail_url}
                      onChange={(event) => update("thumbnail_url", event.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                    <label className="product-btn-secondary cursor-pointer">
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            showToast('info', 'Uploading...');
                            const { original } = await uploadToCloudinary(file);
                            update("thumbnail_url", original);
                            showToast('success', 'Image uploaded');
                          } catch {
                            showToast('error', 'Upload failed');
                          }
                        }}
                      />
                    </label>
                    {form.thumbnail_url && (
                      <div style={{ maxWidth: '60px', maxHeight: '60px' }}>
                        <img 
                          src={form.thumbnail_url} 
                          alt="Thumbnail preview" 
                          style={{ 
                            width: '60px', 
                            height: '60px', 
                            objectFit: 'cover', 
                            borderRadius: '8px',
                            border: '2px solid var(--border)'
                          }} 
                        />
                      </div>
                    )}
                  </div>
                  <small className="text-xs text-[var(--text-muted)]">Direct link to product image</small>
                  {errors.images ? <p className="text-xs text-red-500">{errors.images}</p> : null}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-[var(--text)]">Gallery URLs</label>
                  </div>
                  <div className="space-y-2">
                    {ensureList(form.gallery_urls).map((item, index) => (
                      <div key={`gallery_urls-${index}`} className="flex gap-2">
                        <input
                          type="text"
                          className="product-form-input flex-1"
                          value={item}
                          placeholder="https://..."
                          onChange={(event) => updateArr("gallery_urls", index, event.target.value)}
                        />
                        <label className="product-btn-secondary cursor-pointer">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                showToast('info', 'Uploading...');
                                const { original } = await uploadToCloudinary(file);
                                updateArr("gallery_urls", index, original);
                                showToast('success', 'Image uploaded');
                              } catch {
                                showToast('error', 'Upload failed');
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeRow("gallery_urls", index)}
                          className="product-btn-secondary"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addRow("gallery_urls")}
                    className="product-btn-add"
                  >
                    + Add image
                  </button>
                </div>
              </div>
            </section>

            <section className="product-form-section">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">Features & Highlights</h2>
                <p className="text-sm text-[var(--text-muted)]">List key features and how to use steps.</p>
              </header>
              <div className="space-y-6">
                {renderArrayField("features", "Features", "Key selling point", "Add feature")}
                {renderArrayField("how_to_use", "How to Use", "Usage instruction", "Add step")}
              </div>
            </section>

            {serverError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">{serverError}</div>
            ) : null}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="product-btn-secondary"
                onClick={() => navigate(createPageUrl("Bundles"))}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`product-btn-primary ${isSubmitting ? "opacity-70" : ""}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Create Bundle"}
              </button>
            </div>
          </form>

          {/* ... preview panel ... */}
          <div className="space-y-4">
            <div className={fullscreenPreview ? "preview-fullscreen" : "rounded-2xl border border-[var(--card)] bg-[var(--card)] shadow-sm"}>
              <div className="flex gap-2 justify-between border-b border-[var(--card)] p-3 text-sm font-semibold text-[var(--text-muted)]">
                <div className="flex gap-2">
                  {[
                    { id: "card", label: "Bundle Card" },
                    { id: "page-desktop", label: "Bundle Page – Desktop" },
                    { id: "page-mobile", label: "Bundle Page – Mobile" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPreviewTab(tab.id)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        previewTab === tab.id ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--card)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('desktop')}
                      className={`w-8 h-8 rounded border-none cursor-pointer flex items-center justify-center transition-colors ${
                        viewMode === 'desktop' 
                          ? 'bg-[var(--accent)] text-white' 
                          : 'bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                      title="Desktop View"
                    >
                      🖥️
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('mobile')}
                      className={`w-8 h-8 rounded border-none cursor-pointer flex items-center justify-center transition-colors ${
                        viewMode === 'mobile' 
                          ? 'bg-[var(--accent)] text-white' 
                          : 'bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                      title="Mobile View"
                    >
                      📱
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFullscreenPreview(!fullscreenPreview)}
                    className="product-btn-secondary text-xs"
                  >
                    {fullscreenPreview ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
                  </button>
                </div>
              </div>
              <div className={fullscreenPreview ? "overflow-auto p-4" : "max-h-[75vh] overflow-auto p-4"}>
                {previewTab === "card" ? (
                  <div className="mx-auto max-w-sm">
                    {cardModel ? (
                      <ProductCard product={cardModel} />
                    ) : (
                      <div className="text-center text-[var(--text-muted)] py-8">Loading preview...</div>
                    )}
                  </div>
                ) : null}
                {previewTab === "page-desktop" ? (
                  <div className={fullscreenPreview ? "desktop-preview" : "preview-container overflow-x-auto max-w-full"}>
                    <div className={`mx-auto overflow-hidden rounded-xl border border-[var(--card)] shadow-sm ${
                      viewMode === 'mobile' 
                        ? 'max-w-[390px]' 
                        : fullscreenPreview 
                          ? 'max-w-[1200px]' 
                          : 'min-w-[1200px] max-w-5xl'
                    } ${viewMode === 'mobile' ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                      {pageModel ? (
                        <ProductPageTemplate product={pageModel} isPreview={true} />
                      ) : (
                        <div className="text-center text-[var(--text-muted)] py-8">Loading preview...</div>
                      )}
                    </div>
                  </div>
                ) : null}
                {previewTab === "page-mobile" ? (
                  <div className={fullscreenPreview ? "mobile-preview mx-auto" : `mx-auto w-[390px] overflow-hidden rounded-xl border border-[var(--card)] shadow-sm ${viewMode === 'mobile' ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                    {pageModel ? (
                      <ProductPageTemplate product={pageModel} isPreview={true} />
                    ) : (
                      <div className="text-center text-[var(--text-muted)] py-8">Loading preview...</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--card)] bg-[var(--card)] p-4 text-sm text-[var(--text-muted)] shadow-sm">
              <h3 className="text-sm font-semibold text-[var(--text)]">Preview Summary</h3>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Stock Label</dt>
                  <dd className="font-medium text-[var(--text)]">{stockLabel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Price String</dt>
                  <dd className="font-medium text-[var(--text)]">{priceString}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--text-muted)]">Images</dt>
                  <dd className="font-medium text-[var(--text)]">{previewImages.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
