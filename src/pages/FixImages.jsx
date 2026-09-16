import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/ToastProvider';

export default function FixImages() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [fixing, setFixing] = useState(false);
  const [logs, setLogs] = useState([]);

  const OLD_CLOUD_NAME = 'dd89enrjz';
  const NEW_CLOUD_NAME = 'drsrbzm2t';

  const addLog = (msg) => setLogs(prev => [...prev, msg]);

  const scanImages = async () => {
    setLoading(true);
    setLogs([]);
    setScanResults(null);
    addLog('🔍 Scanning for broken images...');

    try {
      // 1. Scan Products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, thumbnail_url, hover_url, gallery_urls, variants');
      
      const brokenProducts = [];
      products?.forEach(p => {
        let isBroken = false;
        if (p.thumbnail_url?.includes(OLD_CLOUD_NAME)) isBroken = true;
        if (p.hover_url?.includes(OLD_CLOUD_NAME)) isBroken = true;
        if (p.gallery_urls?.some(u => typeof u === 'string' && u.includes(OLD_CLOUD_NAME))) isBroken = true;
        if (p.variants?.some(v => v?.image?.includes(OLD_CLOUD_NAME))) isBroken = true;
        
        if (isBroken) brokenProducts.push(p);
      });

      // 2. Scan Bundles
      const { data: bundles } = await supabase
        .from('bundles')
        .select('id, name, thumbnail_url, hover_image, gallery_urls, variants');

      const brokenBundles = [];
      bundles?.forEach(b => {
        let isBroken = false;
        if (b.thumbnail_url?.includes(OLD_CLOUD_NAME)) isBroken = true;
        if (b.hover_image?.includes(OLD_CLOUD_NAME)) isBroken = true;
        if (b.gallery_urls?.some(u => typeof u === 'string' && u.includes(OLD_CLOUD_NAME))) isBroken = true;
        if (b.variants?.some(v => v?.image?.includes(OLD_CLOUD_NAME))) isBroken = true;
        
        if (isBroken) brokenBundles.push(b);
      });

      // 3. Scan Featured Items
      const { data: featured } = await supabase
        .from('featured_items')
        .select('*');

      const brokenFeatured = [];
      featured?.forEach(f => {
        if (f.custom_image_url?.includes(OLD_CLOUD_NAME)) brokenFeatured.push(f);
      });

      setScanResults({
        products: brokenProducts,
        bundles: brokenBundles,
        featured: brokenFeatured
      });

      addLog(`✅ Scan complete. Found ${brokenProducts.length} products, ${brokenBundles.length} bundles, and ${brokenFeatured.length} featured items with broken images.`);

    } catch (err) {
      console.error(err);
      addLog(`❌ Error scanning: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fixImages = async () => {
    if (!scanResults) return;
    setFixing(true);
    addLog('🛠️ Starting fix...');

    try {
      // Fix Products
      for (const p of scanResults.products) {
        const updates = {};
        if (p.thumbnail_url?.includes(OLD_CLOUD_NAME)) updates.thumbnail_url = p.thumbnail_url.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME);
        if (p.hover_url?.includes(OLD_CLOUD_NAME)) updates.hover_url = p.hover_url.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME);
        
        if (p.gallery_urls?.some(u => typeof u === 'string' && u.includes(OLD_CLOUD_NAME))) {
          updates.gallery_urls = p.gallery_urls.map(u => typeof u === 'string' ? u.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME) : u);
        }

        if (p.variants?.some(v => v?.image?.includes(OLD_CLOUD_NAME))) {
          updates.variants = p.variants.map(v => {
            if (v?.image?.includes(OLD_CLOUD_NAME)) {
              return { ...v, image: v.image.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME) };
            }
            return v;
          });
        }

        const { error } = await supabase.from('products').update(updates).eq('id', p.id);
        if (error) addLog(`❌ Failed to fix product ${p.name}: ${error.message}`);
        else addLog(`✅ Fixed product: ${p.name}`);
      }

      // Fix Bundles
      for (const b of scanResults.bundles) {
        const updates = {};
        if (b.thumbnail_url?.includes(OLD_CLOUD_NAME)) updates.thumbnail_url = b.thumbnail_url.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME);
        if (b.hover_image?.includes(OLD_CLOUD_NAME)) updates.hover_image = b.hover_image.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME);
        
        if (b.gallery_urls?.some(u => typeof u === 'string' && u.includes(OLD_CLOUD_NAME))) {
          updates.gallery_urls = b.gallery_urls.map(u => typeof u === 'string' ? u.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME) : u);
        }

        if (b.variants?.some(v => v?.image?.includes(OLD_CLOUD_NAME))) {
          updates.variants = b.variants.map(v => {
            if (v?.image?.includes(OLD_CLOUD_NAME)) {
              return { ...v, image: v.image.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME) };
            }
            return v;
          });
        }

        const { error } = await supabase.from('bundles').update(updates).eq('id', b.id);
        if (error) addLog(`❌ Failed to fix bundle ${b.name}: ${error.message}`);
        else addLog(`✅ Fixed bundle: ${b.name}`);
      }

      // Fix Featured
      for (const f of scanResults.featured) {
        const newUrl = f.custom_image_url.replace(OLD_CLOUD_NAME, NEW_CLOUD_NAME);
        const { error } = await supabase.from('featured_items').update({ custom_image_url: newUrl }).eq('id', f.id);
        if (error) addLog(`❌ Failed to fix featured item slot ${f.slot_number}: ${error.message}`);
        else addLog(`✅ Fixed featured item slot ${f.slot_number}`);
      }

      showToast('success', 'All images fixed!');
      scanImages(); // Rescan to verify

    } catch (err) {
      console.error(err);
      addLog(`❌ Error fixing: ${err.message}`);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Fix Broken Images</h1>
      <p className="mb-6 text-gray-600">
        This tool scans for images still pointing to the old Cloudinary account ({OLD_CLOUD_NAME}) 
        and updates them to the new account ({NEW_CLOUD_NAME}).
      </p>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={scanImages} 
          disabled={loading || fixing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Scanning...' : 'Scan Database'}
        </button>

        {scanResults && (scanResults.products.length > 0 || scanResults.bundles.length > 0 || scanResults.featured.length > 0) && (
          <button 
            onClick={fixImages} 
            disabled={fixing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {fixing ? 'Fixing...' : 'Fix All Broken Images'}
          </button>
        )}
      </div>

      <div className="bg-gray-100 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
        {logs.length === 0 && <div className="text-gray-500">Ready to scan...</div>}
        {logs.map((log, i) => (
          <div key={i} className="mb-1">{log}</div>
        ))}
      </div>
    </div>
  );
}
