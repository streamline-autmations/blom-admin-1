import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/ToastProvider';

export default function SeedNotifications() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [sourceCat, setSourceCat] = useState('');
  const [targetCat, setTargetCat] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await fetch('/.netlify/functions/admin-category-stats');
      const data = await res.json();
      if (data.ok) {
        setCategories(data.stats);
      }
    } catch (e) {
      console.error('Failed to load categories', e);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const mergeCategories = async () => {
    if (!sourceCat || !targetCat) {
      showToast('Please select both source and target categories', 'error');
      return;
    }
    if (sourceCat === targetCat) {
      showToast('Source and target must be different', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to move all items from "${sourceCat}" to "${targetCat}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/admin-category-merge', {
        method: 'POST',
        body: JSON.stringify({ sourceCategory: sourceCat, targetCategory: targetCat })
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message, 'success');
        fetchCategories(); // Refresh list
        setSourceCat('');
      } else {
        showToast(data.error || 'Merge failed', 'error');
      }
    } catch {
      showToast('Network error during merge', 'error');
    } finally {
      setLoading(false);
    }
  };

  const seed = async () => {
    setLoading(true);
    const now = new Date().toISOString();

    try {
      // 1. Reset localStorage for Orders and Bookings
      localStorage.setItem('last_checked_orders', '1970-01-01T00:00:00.000Z');
      localStorage.setItem('last_checked_course_bookings', '1970-01-01T00:00:00.000Z');
      localStorage.setItem('last_checked_messages', '1970-01-01T00:00:00.000Z');
      localStorage.setItem('last_checked_reviews', '1970-01-01T00:00:00.000Z');

      // 2. Insert 1 Course Booking (purchase)
      // Use API function if possible to avoid RLS issues, otherwise try direct insert
      const { data: courses } = await supabase.from('courses').select('slug').limit(1);
      const slug = courses?.[0]?.slug || 'dummy-course';
      
      // Try to use the server function if available (via fetch)
      try {
        await fetch('/.netlify/functions/admin-course-purchases', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create',
            course_slug: slug,
            buyer_email: 'test@example.com',
            buyer_name: 'Test Buyer',
            invitation_status: 'pending',
            course_type: 'online',
            amount_cents: 10000
          })
        });
      } catch (err) {
        console.warn('Function insert failed, trying direct supabase insert', err);
        const { error: bookingError } = await supabase.from('course_purchases').insert([
          {
            course_slug: slug,
            buyer_email: 'test@example.com',
            buyer_name: 'Test Buyer',
            invitation_status: 'pending',
            course_type: 'online',
            amount_cents: 10000,
            created_at: now
          }
        ]);
        if (bookingError) throw bookingError;
      }

      // 3. Insert 2 Reviews (pending)
      // Use server function if available to bypass RLS
      const { data: products } = await supabase.from('products').select('id').limit(1);
      const productId = products?.[0]?.id;

      if (productId) {
        try {
           await fetch('/.netlify/functions/admin-review-create', {
             method: 'POST',
             body: JSON.stringify({
               product_id: productId,
               rating: 5,
               title: 'Test Review 1',
               content: 'This is a test review pending approval.',
               author_name: 'Reviewer 1',
               status: 'pending'
             })
           });
        } catch(err) {
             console.warn('Function insert failed, trying direct supabase insert', err);
             const { error: reviewError } = await supabase.from('reviews').insert([
               {
                 product_id: productId,
                 rating: 5,
                 title: 'Test Review 1',
                 content: 'This is a test review pending approval.',
                 author_name: 'Reviewer 1',
                 status: 'pending',
                 created_at: now
               },
               {
                 product_id: productId,
                 rating: 4,
                 title: 'Test Review 2',
                 content: 'Another test review.',
                 author_name: 'Reviewer 2',
                 status: 'pending',
                 created_at: now
               }
             ]);
              if (reviewError) {
                console.error('Review seed error:', reviewError);
                showToast(`Review seed failed: ${reviewError.message}`, 'error');
              }
        }
      } else {
        console.warn('No products found to attach reviews to');
      }

      // 4. Insert 2 Messages (new)
      // Use server function if available to bypass RLS
      try {
         await fetch('/.netlify/functions/submit-contact', { // Assuming this exists or similar
            method: 'POST',
            body: JSON.stringify({
              name: 'Test Sender 1',
              email: 'sender1@example.com',
              subject: 'Test Message 1',
              message: 'Hello, this is a test message.'
            })
         });
      } catch (err) {
          console.warn('Function insert failed, trying direct supabase insert', err);
          const { error: messageError } = await supabase.from('messages').insert([
            {
              name: 'Test Sender 1',
              email: 'sender1@example.com',
              subject: 'Test Message 1',
              message: 'Hello, this is a test message.',
              status: 'new',
              created_at: now
            },
            {
              name: 'Test Sender 2',
              email: 'sender2@example.com',
              subject: 'Test Message 2',
              message: 'Another test message.',
              status: 'new',
              created_at: now
            }
          ]);
          if (messageError) {
            console.error('Message seed error:', messageError);
            showToast(`Message seed failed: ${messageError.message}`, 'error');
          }
      }

      showToast('Notifications seeded successfully! Refreshing...', 'success');
      setTimeout(() => window.location.reload(), 1500);

    } catch (e) {
      console.error(e);
      showToast('Failed to seed notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fixBundles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/fix-bundle-categories', {
        method: 'POST',
      });
      const result = await response.json();
      if (result.ok) {
        showToast(result.message || 'Bundles updated successfully', 'success');
        fetchCategories(); // Refresh category list
      } else {
        showToast(result.error || 'Failed to update bundles', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error calling fix function', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fixAllData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/admin-fix-data', {
        method: 'POST',
      });
      const result = await response.json();
      if (result.ok) {
        showToast(`Fixed: ${result.details.productsFixed} products, ${result.details.bundlesFixed} bundles`, 'success');
      } else {
        showToast(result.error || 'Failed to fix data', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error calling fix data function', 'error');
    } finally {
      setLoading(false);
    }
  };

  const normalizeProductCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch('/.netlify/functions/admin-normalize-product-categories', {
        method: 'POST',
      });
      const result = await response.json().catch(() => ({}));
      if (result.ok) {
        showToast(`Normalized ${result.updated || 0} products`, 'success');
        fetchCategories();
      } else {
        showToast(result.error || 'Failed to normalize products', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error normalizing products', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug & Maintenance Tools</h1>
      
      {/* Category Manager */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Category Cleanup</h2>
        <p className="text-sm text-gray-500 mb-4">Merge duplicate or messy categories. Move all products from one category to another.</p>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source Category (Move from)</label>
            <select 
              className="w-full p-2 border rounded"
              value={sourceCat}
              onChange={e => setSourceCat(e.target.value)}
            >
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.total})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Category (Move to)</label>
            <select 
              className="w-full p-2 border rounded"
              value={targetCat}
              onChange={e => setTargetCat(e.target.value)}
            >
              <option value="">Select Category</option>
              {categories.map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.total})</option>
              ))}
            </select>
          </div>
        </div>
        
        <Button onClick={mergeCategories} disabled={loading || !sourceCat || !targetCat} className="w-full md:w-auto">
          {loading ? 'Merging...' : 'Merge Categories'}
        </Button>

        <div className="mt-6">
          <h3 className="font-semibold text-sm mb-2">Current Category Distribution:</h3>
          <div className="bg-gray-50 p-4 rounded max-h-60 overflow-y-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b">
                  <th className="pb-2">Category</th>
                  <th className="pb-2 text-right">Products</th>
                  <th className="pb-2 text-right">Bundles</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => (
                  <tr key={i} className="border-b last:border-0 border-gray-100">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2 text-right text-gray-500">{c.products}</td>
                    <td className="py-2 text-right text-gray-500">{c.bundles}</td>
                    <td className="py-2 text-right font-medium">{c.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-sm mb-2">Normalize Categories</h3>
          <p className="text-sm text-gray-500 mb-4">Converts legacy category names (e.g. &quot;Acrylic System - Core Acrylics&quot;) into slug categories used by the Shop.</p>
          <Button onClick={normalizeProductCategories} disabled={loading} variant="outline" className="w-full md:w-auto">
            {loading ? 'Processing...' : 'Normalize Product Categories'}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
          <h2 className="text-xl font-semibold mb-2">Seed Notifications</h2>
          <p className="text-sm text-gray-500 mb-4">Inserts dummy data to test the notification system.</p>
          <ul className="list-disc ml-6 mb-4 text-sm text-gray-600">
            <li>1 Course Booking (reset last_checked)</li>
            <li>2 Pending Reviews</li>
            <li>2 New Messages</li>
          </ul>
          <Button onClick={seed} disabled={loading} variant="outline">
            {loading ? 'Processing...' : 'Seed Notification Data'}
          </Button>
        </div>

        <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
          <h2 className="text-xl font-semibold mb-2">Fix Bundle Categories</h2>
          <p className="text-sm text-gray-500 mb-4">Moves &quot;Collection&quot; products to &quot;Bundle Deals&quot; category.</p>
          <p className="text-xs text-gray-400 mb-4">Includes: Red Collection, High Tea, Blossom Sugar Rush, etc.</p>
          <Button onClick={fixBundles} disabled={loading} variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
            {loading ? 'Processing...' : 'Fix Specific Bundles'}
          </Button>
        </div>

        <div className="p-6 bg-white rounded-lg shadow border border-gray-200">
          <h2 className="text-xl font-semibold mb-2">Repair All Data</h2>
          <p className="text-sm text-gray-500 mb-4">Fixes missing variants and images for ALL products/bundles to prevent &quot;Oops&quot; errors on frontend.</p>
          <Button onClick={fixAllData} disabled={loading} variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 w-full">
            {loading ? 'Processing...' : 'Run Data Repair (Save All)'}
          </Button>
        </div>
      </div>
    </div>
  );
}
