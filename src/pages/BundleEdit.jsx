import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ProductCard from "../components/ProductCard";
import { ProductPageTemplate } from "../../ProductPageTemplate";
import { useToast } from "../components/ui/ToastProvider";
import { supabase } from "../components/supabaseClient";
import { uploadToCloudinary } from "../lib/cloudinary";
import { createPageUrl } from "../utils";


const generateSKU = () => {
  const prefix = 'BUN';
  const timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${timestamp}`;
};

const initialFormState = {
  name: "",
  slug: "",
  sku: generateSKU(),
  category: "Bundle Deals",
  product_type: "collection",
  price: "",
  compare_at_price: "",
  weight: "",
  barcode: "",
  short_description: "",
  overview: "",
  thumbnail_url: "",
  hover_url: "",
  gallery_urls: [""],
  variants: [{ label: "", image: "" }],
  features: [""],
  how_to_use: [""],
  inci_ingredients: [""],
  key_ingredients: [""],
  size: "",
  shelf_life: "",
  claims: [""],
  meta_title: "",
  meta_description: "",
  is_active: true,
  is_featured: false,
  status: "active",
  badges: [""],
  related: [""],
  bundle_products: [],
};

const ensureList = (value) => {
  if (Array.isArray(value) && value.length > 0) return value;
  return [""];
};

export default function BundleEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [previewTab, setPreviewTab] = useState("card");
  const [viewMode, setViewMode] = useState("desktop");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);

  // Default badges to empty array with one empty string if null/undefined
  useEffect(() => {
    if (!form.badges || form.badges.length === 0) {
      setForm(prev => ({ ...prev, badges: [""] }));
    }
  }, []);


  // Load bundle from database
  useEffect(() => {
    async function loadBundle() {
      if (!id) {
        setLoading(false);
        navigate(createPageUrl("Bundles"));
        return;
      }

      try {
        // Load from bundles table
        const { data: bundle, error } = await supabase
          .from('bundles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('Failed to load bundle:', error);
          showToast('error', 'Failed to load bundle');
          setLoading(false);
          return;
        }

        // Load bundle items
        let bundleProducts = [];
        if (bundle) {
          const { data: items } = await supabase
            .from('bundle_items')
            .select('product_id, qty, variant_id')
            .eq('bundle_id', bundle.id);

          if (items && items.length > 0) {
            bundleProducts = items.map(item => ({
              product_id: item.product_id,
              quantity: item.qty || 1,
              variant_id: item.variant_id !== null ? item.variant_id.toString() : '', // Convert to string for form
            }));
          }
        }

        if (bundle) {
          // Map bundles table columns to form fields properly
          const bundleImages = Array.isArray(bundle.images) ? bundle.images : [];
          const rawGalleryUrls = Array.isArray(bundle.gallery_urls) ? bundle.gallery_urls : [];
          
          // Combine and deduplicate all available images
          let allImages = [...bundleImages, ...rawGalleryUrls].filter(Boolean);
          allImages = [...new Set(allImages)];

          // Determine the primary thumbnail
          const thumbnail = bundle.thumbnail_url || allImages[0] || '';
          
          // Filter out the thumbnail from the gallery list to prevent duplicates in the UI
          // The user only wants to see "extra" images in the gallery list
          const galleryForForm = allImages.filter(url => url !== thumbnail);
          
          setForm({
            id: bundle.id,
            name: bundle.name || '',
            slug: bundle.slug || '',
            sku: bundle.sku || generateSKU(),
            category: bundle.category || 'Bundle Deals',
            product_type: bundle.product_type === 'bundle' ? 'bundle' : 'collection',
            status: bundle.status || 'active',
            price: bundle.price_cents ? (bundle.price_cents / 100).toString() : '',
            compare_at_price: bundle.compare_at_price_cents ? (bundle.compare_at_price_cents / 100).toString() : '',
            weight: bundle.weight || '',
            barcode: bundle.barcode || '',
            short_description: bundle.short_desc || '',
            overview: bundle.long_desc || '',
            thumbnail_url: thumbnail,
            hover_url: bundle.hover_image || '',
            gallery_urls: galleryForForm.length > 0 ? galleryForForm : [''],
            variants: Array.isArray(bundle.variants) ? bundle.variants : [{ label: "", image: "" }],
            features: Array.isArray(bundle.features) ? bundle.features : [''],
            how_to_use: Array.isArray(bundle.how_to_use) ? bundle.how_to_use : [''],
            inci_ingredients: Array.isArray(bundle.inci_ingredients) ? bundle.inci_ingredients : [''],
            key_ingredients: Array.isArray(bundle.key_ingredients) ? bundle.key_ingredients : [''],
            size: bundle.size || '',
            shelf_life: bundle.shelf_life || '',
            claims: Array.isArray(bundle.claims) ? bundle.claims : [''],
            meta_title: bundle.meta_title || '',
            meta_description: bundle.meta_description || '',
            is_active: bundle.is_active !== false,
            is_featured: bundle.is_featured || false,
            badges: Array.isArray(bundle.badges) ? bundle.badges : [''],
            related: Array.isArray(bundle.related) ? bundle.related : [''],
            bundle_products: bundleProducts,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading bundle:', err);
        showToast('error', 'Error loading bundle');
        setLoading(false);
      }
    }

    loadBundle();
  }, [id]);

  // Load all products for bundle selection
  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, name, price, variants')
        .eq('is_active', true)
        .order('name');
      setAllProducts(data || []);
    }
    loadProducts();
  }, []);

  // Auto-calculate compare_at_price based on bundle components
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

      try {
        // Fetch prices for the selected products
        const { data: products, error } = await supabase
          .from('products')
          .select('id, price')
          .in('id', productIds);

        if (error) throw error;

        // Create a map for quick price lookup
        const priceMap = new Map(products.map(p => [p.id, p.price]));

        // Calculate the total compare_at_price
        const total = form.bundle_products.reduce((acc, item) => {
          const price = priceMap.get(item.product_id) || 0;
          const quantity = parseInt(item.quantity) || 0;
          return acc + (price * quantity);
        }, 0);

        // Update the form state
        setForm(prev => ({ ...prev, compare_at_price: total.toFixed(2) }));

      } catch (error) {
        console.error('Error calculating compare price:', error.message);
      }
    };

    // Run the calculation when the bundle_products array changes
    calculateComparePrice();
  }, [form.bundle_products]);

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
      if (field === "variants") {
        next.push({ label: "", image: "" });
      } else {
        next.push("");
      }
      return { ...previous, [field]: next };
    });
  };

  const removeRow = (field, index) => {
    setForm((previous) => {
      const next = getArrayFromPrevious(previous, field);
      next.splice(index, 1);
      if (field === "variants") {
        return { ...previous, [field]: next.length ? next : [{ label: "", image: "" }] };
      }
      return { ...previous, [field]: next.length ? next : [""] };
    });
  };

  const priceNumber = useMemo(() => {
    const parsed = parseFloat(form.price);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [form.price]);

  const compareAtNumber = useMemo(() => {
    const parsed = parseFloat(form.compare_at_price);
    return Number.isFinite(parsed) ? parsed : null;
  }, [form.compare_at_price]);

  const weightNumber = useMemo(() => {
    if (form.weight === "" || form.weight === null || form.weight === undefined) return null;
    const parsed = parseFloat(form.weight);
    return Number.isFinite(parsed) ? parsed : null;
  }, [form.weight]);

  const galleryUrls = useMemo(
    () => ensureList(form.gallery_urls).map((url) => url.trim()).filter(Boolean),
    [form.gallery_urls]
  );

  const badges = useMemo(
    () => ensureList(form.badges).map((item) => item.trim()).filter(Boolean),
    [form.badges]
  );

  const claims = useMemo(
    () => ensureList(form.claims).map((item) => item.trim()).filter(Boolean),
    [form.claims]
  );

  const related = useMemo(
    () => ensureList(form.related).map((item) => item.trim()).filter(Boolean),
    [form.related]
  );

  const variants = useMemo(() => {
    const list = ensureList(form.variants);
    return list
      .map((item) => {
        if (typeof item === "string") {
          return item.trim() ? { label: item.trim(), image: "" } : null;
        }
        return (item?.label?.trim() || item?.image?.trim()) ? {
          label: item.label?.trim() || "",
          image: item.image?.trim() || ""
        } : null;
      })
      .filter(Boolean);
  }, [form.variants]);

  const features = useMemo(
    () => ensureList(form.features).map((item) => item.trim()).filter(Boolean),
    [form.features]
  );

  const howToUse = useMemo(
    () => ensureList(form.how_to_use).map((item) => item.trim()).filter(Boolean),
    [form.how_to_use]
  );

  const inciIngredients = useMemo(
    () => ensureList(form.inci_ingredients).map((item) => item.trim()).filter(Boolean),
    [form.inci_ingredients]
  );

  const keyIngredients = useMemo(
    () => ensureList(form.key_ingredients).map((item) => item.trim()).filter(Boolean),
    [form.key_ingredients]
  );

  const images = useMemo(() => {
    const primary = form.thumbnail_url?.trim();
    // Exclude hover_url from the main images list as requested
    // const hover = form.hover_url?.trim();
    const list = [primary, ...galleryUrls].filter(Boolean);
    // Deduplicate images
    return [...new Set(list)];
  }, [form.thumbnail_url, galleryUrls]);

  const previewImages = useMemo(
    () => (images.length ? images : ["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect fill='%23f0f0f0' width='800' height='800'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999' font-size='24' font-family='system-ui'%3ENo Image%3C/text%3E%3C/svg%3E"]),
    [images]
  );

  const stockLabel = useMemo(() => {
    if (form.status === "archived") return "Archived";
    // Stock is determined by bundle components, not a separate field
    return "In Stock";
  }, [form.status]);

  const priceString = useMemo(() => {
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) return "R0";
    return `R${Math.round(priceNumber)}`;
  }, [priceNumber]);

  const cardModel = useMemo(
    () => ({
      id: form.id || "bundle-preview",
      name: form.name || "Bundle",
      slug: form.slug || "bundle",
      price_cents: Number.isFinite(priceNumber) ? Math.round(priceNumber * 100) : 0,
      compare_at_price_cents: compareAtNumber ? Math.round(compareAtNumber * 100) : undefined,
      short_desc: form.short_description || "",
      images: previewImages,
      stock_qty: form.status !== "archived" ? 1 : 0, // Stock determined by components
      badges,
    }),
    [badges, form.id, form.name, form.short_description, form.slug, form.status, previewImages, priceNumber, compareAtNumber]
  );

  const pageModel = useMemo(
    () => ({
      name: form.name || "Bundle",
      slug: form.slug || "bundle",
      category: form.product_type === 'bundle' ? 'Bundle Deals' : 'Collections',
      shortDescription: form.short_description || "",
      overview: form.overview || "",
      price: priceString,
      compareAtPrice: compareAtNumber ? `R${Math.round(compareAtNumber)}` : undefined,
      stock: stockLabel,
      images: previewImages,
      features,
      howToUse,
      ingredients: {
        inci: inciIngredients,
        key: keyIngredients,
      },
      details: {
        size: form.size || "",
        shelfLife: form.shelf_life || "",
        claims,
      },
      variants,
      related,
      rating: 4.8,
      reviewCount: 124,
      reviews: [],
      seo: {
        title: form.meta_title?.trim() || form.name || "",
        description: form.meta_description?.trim() || form.short_description || "",
      },
    }),
    [
      claims,
      compareAtNumber,
      features,
      form.meta_description,
      form.meta_title,
      form.name,
      form.overview,
      form.short_description,
      form.size,
      form.slug,
      form.shelf_life,
      howToUse,
      inciIngredients,
      keyIngredients,
      previewImages,
      priceString,
      related,
      stockLabel,
      variants,
    ]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError("");

    // Validate
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Name is required";
    if (!form.slug.trim()) nextErrors.slug = "Slug is required";
    if (!form.sku.trim()) nextErrors.sku = "SKU is required";

    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      nextErrors.price = "Price must be greater than 0";
    }

    if (form.bundle_products.length === 0 || !form.bundle_products.some(bp => bp.product_id)) {
      nextErrors.bundle_products = "Add at least one product to the bundle";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast("error", "Please fix the highlighted fields");
      return;
    }

    const payload = {
      id: form.id,
      name: form.name.trim(),
      slug: form.slug.trim(),
      sku: form.sku.trim(),
      category: 'Bundle Deals',
      product_type: 'bundle', // Force to 'bundle' and ignore form.product_type
      status: form.status,
      price: Number.isFinite(priceNumber) ? priceNumber : 0,
      compare_at_price: Number.isFinite(compareAtNumber ?? Number.NaN) ? compareAtNumber : null,
      weight: weightNumber,
      barcode: form.barcode?.trim() || null,
      short_description: form.short_description,
      overview: form.overview || form.short_description,
      description: form.overview || form.short_description,
      thumbnail_url: form.thumbnail_url?.trim() || "",
      hover_url: form.hover_url?.trim() || "",
      gallery_urls: galleryUrls,
      variants,
      features,
      how_to_use: howToUse,
      inci_ingredients: inciIngredients,
      key_ingredients: keyIngredients,
      size: form.size,
      shelf_life: form.shelf_life,
      claims,
      meta_title: form.meta_title,
      meta_description: form.meta_description,
      is_active: Boolean(form.is_active),
      is_featured: Boolean(form.is_featured),
      badges,
      related,
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        const message = data?.error || data?.message || "Failed to update bundle";
        setServerError(message);
        showToast("error", message);
        return;
      }

      showToast("success", "Bundle updated successfully");
      navigate(createPageUrl("Bundles"));
    } catch (error) {
      const message = error?.message || "Failed to update bundle";
      setServerError(message);
      showToast("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
        {errorKey && errors[errorKey] ? (
          <p className="text-xs text-red-500">{errors[errorKey]}</p>
        ) : null}
      </div>
    );
  };

  const textareaClass = (hasError) => `product-form-textarea${hasError ? " border-red-500 focus:ring-rose-500" : ""}`;

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center py-12">
          <div style={{
            width: '32px',
            height: '32px',
            border: '4px solid var(--card)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        /* Product Form Styling - Matching ProductEdit */
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
        .product-error-text {
          color: #ef4444;
          font-size: 12px;
          margin-top: 4px;
        }
        .product-required {
          color: #ef4444;
        }
        /* Bundle product item styles */
        .bundle-item {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          padding: 1rem;
          background: var(--bg);
          border-radius: 12px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          flex-wrap: wrap;
        }
        /* Utility Classes */
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-y-6 > * + * { margin-top: 1.5rem; }
        .grid { display: grid; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .gap-6 { gap: 1.5rem; }
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

        /* Fullscreen Preview Styles */
        .preview-fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: white;
          z-index: 9999;
          overflow-y: auto;
          padding: 0;
        }

        .preview-fullscreen .desktop-preview {
          max-width: 1200px;
          margin: 0 auto;
        }

        .preview-fullscreen .mobile-preview {
          max-width: 375px;
          margin: 0 auto;
        }
      `}</style>
      <div className="flex h-full flex-col">
        <div className="form-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => navigate(createPageUrl("Bundles"))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--bg)',
                boxShadow: '2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light)',
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text)' }} />
            </button>
            <div className="font-bold text-lg">Edit Bundle</div>
          </div>
          <div className="text-sm text-[var(--text-muted)]">Update bundle details and preview changes.</div>
        </div>

        <div className="form-content-area grid grid-cols-1 gap-6 xl:grid-cols-2">
          <style>{`
            /* Enhanced mobile responsiveness for BundleEdit - ProductEdit Pattern */
            @media (max-width: 768px) {
              .form-content-area {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                padding: 1rem;
              }

              .form-content-area.grid {
                grid-template-columns: 1fr !important;
                gap: 1rem !important;
              }

              .product-form-section {
                padding: 1rem !important;
                margin-bottom: 1rem !important;
                overflow-x: auto !important;
                -webkit-overflow-scrolling: touch;
                min-width: 320px !important;
                box-sizing: border-box !important;
              }

              .product-form-input,
              .product-form-textarea,
              .product-form-select {
                width: 100% !important;
                font-size: 16px !important; /* Prevent iOS zoom */
                padding: 12px 16px !important;
                box-sizing: border-box !important;
              }

              .grid.gap-4.md\\:grid-cols-2 {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 1rem !important;
              }

              .grid.gap-4.md\\:grid-cols-2 > * {
                flex: 1 1 300px !important;
                min-width: 280px !important;
              }

              /* Bundle items - horizontal scroll support */
              .bundle-item {
                display: flex !important;
                flex-direction: row !important;
                gap: 0.75rem !important;
                padding: 1rem !important;
                overflow-x: auto !important;
                -webkit-overflow-scrolling: touch;
                min-width: 320px !important;
                align-items: stretch !important;
                box-sizing: border-box !important;
              }

              .bundle-item select,
              .bundle-item input {
                min-width: 120px !important;
                flex: 1 !important;
                font-size: 16px !important;
              }

              .product-btn-secondary {
                width: auto !important;
                min-height: 44px !important;
                flex-shrink: 0 !important;
                padding: 10px 16px !important;
              }

              /* Action buttons - stack vertically */
              .flex.items-center.justify-end.gap-3 {
                flex-direction: column !important;
                gap: 0.75rem !important;
                width: 100% !important;
              }

              .flex.items-center.justify-end.gap-3 button {
                width: 100% !important;
                min-height: 48px !important;
              }

              /* Variant rows - stack vertically */
              .flex.gap-2 {
                flex-direction: column !important;
                gap: 0.5rem !important;
                width: 100% !important;
                box-sizing: border-box !important;
              }

              .flex.gap-2 input {
                width: 100% !important;
              }

              /* Touch optimization improvements */
              button,
              input,
              select,
              textarea {
                touch-action: manipulation;
                -webkit-tap-highlight-color: rgba(0,0,0,0.1);
              }

              button:active {
                transform: scale(0.98);
              }

              /* Prevent zoom on input focus */
              input[type="text"],
              input[type="number"],
              input[type="email"],
              input[type="tel"],
              input[type="url"],
              textarea,
              select {
                font-size: 16px !important;
              }

              /* Better form field spacing */
              .space-y-2 > * + * {
                margin-top: 0.75rem !important;
              }

              .space-y-4 > * + * {
                margin-top: 1rem !important;
              }

              .space-y-6 > * + * {
                margin-top: 1.5rem !important;
              }

              /* Bundle products scroll indicator */
              .space-y-3::before {
                content: '← Scroll horizontally to see more →';
                display: block;
                text-align: center;
                font-size: 12px;
                color: var(--text-muted);
                margin-bottom: 8px;
                opacity: 0.7;
              }

              /* Checkbox and label alignment */
              .flex.items-center.gap-3 {
                flex-direction: row !important;
                align-items: flex-start !important;
                gap: 0.75rem !important;
              }

              .flex.items-center.gap-3 input[type="checkbox"] {
                margin-top: 2px !important;
              }

              /* Small text adjustments */
              small {
                display: block !important;
                margin-top: 4px !important;
                font-size: 12px !important;
              }
            }

            @media (max-width: 480px) {
              .form-content-area {
                padding: 0.5rem !important;
              }

              .product-form-section {
                padding: 0.75rem !important;
                min-width: 280px !important;
              }

              .bundle-item {
                min-width: 300px !important;
                padding: 0.75rem !important;
                gap: 0.5rem !important;
              }

              .product-form-input,
              .product-form-textarea,
              .product-form-select {
                padding: 10px 12px !important;
                font-size: 16px !important;
              }

              /* Optimize spacing for small screens */
              .space-y-6 > * + * {
                margin-top: 1rem !important;
              }

              .space-y-4 > * + * {
                margin-top: 0.75rem !important;
              }

              .space-y-2 > * + * {
                margin-top: 0.5rem !important;
              }

              /* Ensure readability */
              .text-sm {
                font-size: 13px !important;
              }

              .text-xs {
                font-size: 12px !important;
              }
            }

            /* Enhanced scrolling styles for all screen sizes */
            .bundle-item,
            .product-form-section,
            .flex.gap-2 {
              scrollbar-width: thin;
              scrollbar-color: var(--accent) transparent;
            }

            .bundle-item::-webkit-scrollbar,
            .product-form-section::-webkit-scrollbar,
            .flex.gap-2::-webkit-scrollbar {
              height: 4px;
            }

            .bundle-item::-webkit-scrollbar-track,
            .product-form-section::-webkit-scrollbar-track,
            .flex.gap-2::-webkit-scrollbar-track {
              background: transparent;
            }

            .bundle-item::-webkit-scrollbar-thumb,
            .product-form-section::-webkit-scrollbar-thumb,
            .flex.gap-2::-webkit-scrollbar-thumb {
              background: var(--accent);
              border-radius: 2px;
            }

            /* Landscape mobile optimizations */
            @media (max-width: 768px) and (orientation: landscape) {
              .form-content-area {
                padding: 0 12px 12px;
              }

              .product-form-section {
                padding: 0.75rem;
              }

              .bundle-item,
              .flex.gap-2 {
                padding: 0.5rem;
                gap: 0.5rem;
              }
            }
          `}</style>
          <form className="space-y-6" onSubmit={handleSubmit}>
          <section className="product-form-section">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">Basic Information</h2>
              <p className="text-sm text-[var(--text-muted)]">Name, slug and classification for the bundle.</p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[var(--text)]" htmlFor="name">
                  Bundle Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  className="product-form-input"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Ultimate Nail Care Bundle"
                />
                {errors.name ? <p className="text-xs text-red-500">{errors.name}</p> : null}
              </div>
              
              {/* Slug and SKU are hidden but preserved */}
              <input type="hidden" value={form.slug} />
              <input type="hidden" value={form.sku} />

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
              <h2 className="text-lg font-semibold text-[var(--text)]">Bundle Products</h2>
              <p className="text-sm text-[var(--text-muted)]">Select products included in this bundle.</p>
            </header>
            <div className="space-y-3">
              {form.bundle_products.map((item, index) => {
                const selectedProduct = allProducts.find(p => p.id === item.product_id);
                const productVariants = selectedProduct?.variants || [];
                const hasVariants = productVariants.length > 0;
                
                return (
                  <div key={index} className="bundle-item">
                    <select
                      value={item.product_id || ''}
                      onChange={(e) => {
                        const updated = [...form.bundle_products];
                        updated[index] = { ...updated[index], product_id: e.target.value, variant_id: '' };
                        setForm(prev => ({ ...prev, bundle_products: updated }));
                      }}
                      className="product-form-select flex-1"
                    >
                      <option value="">Select product...</option>
                      {allProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    {hasVariants && (
                      <select
                        value={item.variant_id || ''}
                        onChange={(e) => {
                          const updated = [...form.bundle_products];
                          updated[index] = { ...updated[index], variant_id: e.target.value };
                          setForm(prev => ({ ...prev, bundle_products: updated }));
                        }}
                        className="product-form-select flex-1"
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
                      value={item.quantity || 1}
                      onChange={(e) => {
                        const updated = [...form.bundle_products];
                        updated[index] = { ...updated[index], quantity: parseInt(e.target.value) || 1 };
                        setForm(prev => ({ ...prev, bundle_products: updated }));
                      }}
                      className="product-form-input"
                      style={{ width: '100px' }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const updated = form.bundle_products.filter((_, i) => i !== index);
                        setForm(prev => ({ ...prev, bundle_products: updated }));
                      }}
                      className="product-btn-secondary"
                    >
                      Remove
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
                className="product-btn-add"
              >
                + Add Product
              </button>
              {errors.bundle_products ? (
                <p className="text-xs text-red-500">{errors.bundle_products}</p>
              ) : null}
            </div>
          </section>

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
                  placeholder="399"
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
                  placeholder="499"
                  readOnly
                />
                <small className="text-xs text-[var(--text-muted)]">Auto-calculated from bundle components</small>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[var(--text)]" htmlFor="weight">
                  Weight (grams)
                </label>
                <input
                  id="weight"
                  type="number"
                  min="0"
                  step="0.01"
                  className="product-form-input"
                  value={form.weight}
                  onChange={(event) => update("weight", event.target.value)}
                  placeholder="500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[var(--text)]" htmlFor="barcode">
                  Barcode
                </label>
                <input
                  id="barcode"
                  type="text"
                  className="product-form-input"
                  value={form.barcode}
                  onChange={(event) => update("barcode", event.target.value)}
                  placeholder="6001234567890"
                />
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
                  placeholder="A complete bundle of our best-selling nail care products."
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
                  placeholder="Detailed bundle description, what's included and benefits."
                />
              </div>
            </div>
          </section>

          <section className="product-form-section">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">Images</h2>
              <p className="text-sm text-[var(--text-muted)]">Primary, hover and gallery imagery.</p>
            </header>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[var(--text)]" htmlFor="thumbnail_url">
                  Thumbnail URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="thumbnail_url"
                    type="url"
                    className="product-form-input flex-1"
                    value={form.thumbnail_url}
                    onChange={(event) => update("thumbnail_url", event.target.value)}
                    placeholder="https://..."
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
                          } catch  {
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
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-[var(--text)]">Gallery URLs</label>
                  {errors.images ? (
                    <span className="text-xs font-medium text-red-500">{errors.images}</span>
                  ) : null}
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
                          } catch  {
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
                {errors.images ? (
                  <p className="text-xs text-red-500">{errors.images}</p>
                ) : null}
              </div>
            </div>
          </section>

          {/* Variants & Highlights removed */}

          <section className="product-form-section">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">Ingredients</h2>
              <p className="text-sm text-[var(--text-muted)]">Break down formulation details.</p>
            </header>
            <div className="space-y-6">
              {renderArrayField("inci_ingredients", "INCI Ingredients", "Water (Aqua)", "Add INCI")}
              {renderArrayField("key_ingredients", "Key Ingredients", "Biotin", "Add key ingredient")}
            </div>
          </section>

          <section className="product-form-section">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">Product Details</h2>
              <p className="text-sm text-[var(--text-muted)]">Supporting specifications and claims.</p>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[var(--text)]" htmlFor="size">
                  Size
                </label>
                <input
                  id="size"
                  type="text"
                  className="product-form-input"
                  value={form.size}
                  onChange={(event) => update("size", event.target.value)}
                  placeholder="Bundle"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[var(--text)]" htmlFor="shelf_life">
                  Shelf Life
                </label>
                <input
                  id="shelf_life"
                  type="text"
                  className="product-form-input"
                  value={form.shelf_life}
                  onChange={(event) => update("shelf_life", event.target.value)}
                  placeholder="12 months"
                />
              </div>
            </div>
            <div className="mt-4">
              {renderArrayField("claims", "Claims", "Vegan", "Add claim")}
            </div>
          </section>

          {/* SEO removed */}

          <section className="product-form-section">
            <header className="mb-4">
              <h2 className="text-lg font-semibold text-[var(--text)]">Display Settings</h2>
              <p className="text-sm text-[var(--text-muted)]">Control visibility across storefront experiences.</p>
            </header>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-sm font-medium text-[var(--text)]" htmlFor="is_active">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => update("is_active", event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--card)]"
                />
                Active
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-[var(--text)]" htmlFor="is_featured">
                <input
                  id="is_featured"
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(event) => update("is_featured", event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--card)]"
                />
                Featured bundle
              </label>
            </div>
          </section>

          {/* Related Products removed */}

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
              {isSubmitting ? "Saving..." : "Update Bundle"}
            </button>
          </div>
        </form>

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
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Bundle Products</dt>
                <dd className="font-medium text-[var(--text)]">{form.bundle_products.filter(b => b.product_id).length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

