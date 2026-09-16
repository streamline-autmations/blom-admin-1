import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Upload, Save, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../components/ui/ToastProvider';
import { uploadToCloudinary } from '../lib/cloudinary';

export default function Featured() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current featured slots
  const { data: featuredItems } = useQuery({
    queryKey: ['featuredItems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('featured_items')
        .select('*, products(id, name, thumbnail_url, price)')
        .order('slot_number');
      if (error) throw error;
      return data;
    }
  });

  // Fetch all active products for the dropdown
  const { data: allProducts } = useQuery({
    queryKey: ['activeProducts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, thumbnail_url')
        .eq('is_active', true)
        .order('name');
      return data || [];
    }
  });

  return (
    <>
      <style>{`
        .featured-section-card {
          background: var(--card);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }
        .featured-form-select {
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
        .featured-form-select:focus {
          outline: none;
          box-shadow: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
        }
        .featured-btn-primary {
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
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
        }
        .featured-btn-primary:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .featured-btn-primary:not(:disabled):hover {
          transform: translateY(-2px);
        }
        .featured-image-preview {
          aspect-ratio: 4/5;
          background: var(--bg);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          border: 1px solid var(--border);
        }
        .featured-custom-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          font-size: 11px;
          padding: 4px 12px;
          border-radius: 12px;
          font-weight: 500;
        }
        .featured-upload-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          opacity: 0;
          transition: opacity 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
        }
        .featured-image-preview:hover .featured-upload-overlay {
          opacity: 1;
        }
      `}</style>
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text)' }}>Featured Products</h1>
          <p className="text-[var(--text-muted)]">Select 3 products to highlight on the homepage. You can set a custom image for each.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(slotNum => {
            const item = featuredItems?.find(f => f.slot_number === slotNum) || {};
            return (
              <FeaturedSlotCard
                key={slotNum}
                slotNumber={slotNum}
                item={item}
                allProducts={allProducts}
                onSave={() => queryClient.invalidateQueries(['featuredItems'])}
                showToast={showToast}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

function FeaturedSlotCard({ slotNumber, item, allProducts, onSave, showToast }) {
  const [productId, setProductId] = useState(item.product_id || '');
  const [customImage, setCustomImage] = useState(item.custom_image_url || '');
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when data loads
  React.useEffect(() => {
    setProductId(item.product_id || '');
    setCustomImage(item.custom_image_url || '');
  }, [item]);

  const selectedProduct = allProducts?.find(p => p.id === productId);

  // Fallback preview: custom image -> product thumb -> placeholder
  const previewImage = customImage || selectedProduct?.thumbnail_url;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/.netlify/functions/save-featured', {
        method: 'POST',
        body: JSON.stringify({
          slot_number: slotNumber,
          product_id: productId,
          custom_image_url: customImage
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('success', `Slot ${slotNumber} updated!`);
      onSave();
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save slot');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('info', 'Uploading image...');
      const result = await uploadToCloudinary(file, `featured-slot-${slotNumber}`);
      setCustomImage(result.hero); // Use the hero image URL
      showToast('success', 'Image uploaded ready to save');
    } catch (err) {
      console.error(err);
      showToast('error', 'Upload failed');
    }
  };

  return (
    <div className="featured-section-card flex flex-col h-full">
      <div className="font-bold text-lg mb-4 pb-3" style={{
        borderBottom: '1px solid var(--border)',
        color: 'var(--text)'
      }}>
        Position #{slotNumber}
      </div>

      {/* Image Preview */}
      <div className="featured-image-preview mb-4">
        {previewImage ? (
          <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
            <ImageIcon size={32} className="mb-2 opacity-50" />
            <span className="text-sm">No Product Selected</span>
          </div>
        )}

        {/* Overlay for Upload */}
        <label className="featured-upload-overlay">
          <Upload size={24} className="mb-2" />
          <span className="text-sm font-medium">Change Featured Image</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        {customImage && (
           <div className="featured-custom-badge">
             Custom Image Active
           </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4 flex-1">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Select Product
          </label>
          <select
            className="featured-form-select"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">-- Empty Slot --</option>
            {allProducts?.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {customImage && (
          <button
            onClick={() => setCustomImage('')}
            className="text-xs flex items-center gap-1"
            style={{
              color: '#ef4444',
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer'
            }}
          >
            <X size={12} /> Remove custom image (use product default)
          </button>
        )}
      </div>

      <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="featured-btn-primary"
        >
          {isSaving ? 'Saving...' : <><Save size={16} /> Save Slot</>}
        </button>
      </div>
    </div>
  );
}
