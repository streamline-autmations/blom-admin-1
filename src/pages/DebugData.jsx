import { useState } from 'react';
import { api } from '../components/data/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

export default function DebugData() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});

  const runCheck = async (name, fn) => {
    setLoading(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: null }));
    try {
      const result = await fn();
      setResults(prev => ({ ...prev, [name]: result }));
    } catch (error) {
      setErrors(prev => ({ ...prev, [name]: error.message }));
    } finally {
      setLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  // Check 1: Environment
  const checkEnv = async () => {
    const url = import.meta.env.VITE_SUPABASE_URL || '';
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    return {
      url: url ? `${url.substring(0, 20)}...` : '❌ Missing',
      key: key ? `${key.substring(0, 20)}...` : '❌ Missing',
      status: url && key ? '✅ OK' : '❌ Missing',
    };
  };

  // Check 2: Products
  const checkProducts = async () => {
    const products = await api.listProducts();
    return {
      count: products.length,
      first3: products.slice(0, 3).map(p => p.name),
      status: products.length > 0 ? '✅' : '⚠️ No products',
    };
  };

  // Check 3: Inventory
  const checkInventory = async () => {
    let product = (await api.listProducts())[0];
    if (!product) {
      // Create debug product
      product = await api.upsertProduct({
        name: 'Debug Product',
        slug: 'debug-product',
        status: 'active',
        price_cents: 9999,
        stock_qty: 0,
      });
    }

    const { product: updated, movement } = await api.adjustStock({
      productId: product.id,
      delta: 1,
      reason: 'debug'
    });
    return {
      product_name: updated.name,
      new_stock: updated.stock_qty,
      movement_delta: movement.delta,
      status: '✅',
    };
  };

  // Check 4: Specials
  const checkSpecials = async () => {
    let specials = await api.listSpecials();
    if (specials.length === 0) {
      // Create test special
      const special = await api.upsertSpecial({
        scope: 'sitewide',
        discount_type: 'percent',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
      });
      specials = [special];
    }
    return {
      count: specials.length,
      first: specials[0]?.discount_type,
      status: '✅',
    };
  };

  // Check 5: Bundles
  const checkBundles = async () => {
    const products = await api.listProducts();
    let bundles = await api.listBundles();

    if (bundles.length === 0 && products.length > 0) {
      // Create test bundle
      const bundle = await api.upsertBundle({
        name: 'Debug Bundle',
        slug: 'debug-bundle',
        status: 'active',
        pricing_mode: 'percent_off',
        discount_value: 5,
        price_cents: products[0].price_cents,
        items: [{ product_id: products[0].id, qty: 1 }],
      });
      bundles = [bundle];
    }

    return {
      count: bundles.length,
      first_bundle: bundles[0]?.name,
      items_count: bundles[0]?.items?.length || 0,
      status: '✅',
    };
  };

  // Check 6: Messages
  const checkMessages = async () => {
    const testMsg = await api.createMessage({
      full_name: 'Debug Test',
      email: 'debug@test.com',
      inquiry_type: 'general',
      subject: 'Test Message',
      body: 'This is a test message',
      status: 'new',
    });

    const messages = await api.listMessages();
    return {
      total_count: messages.length,
      test_message_id: testMsg.id,
      status: '✅',
    };
  };

  // Check 7: Reviews
  const checkReviews = async () => {
    const products = await api.listProducts();
    if (products.length === 0) return { status: '⚠️ No products' };

    const testReview = await api.createReview({
      product_id: products[0].id,
      author_name: 'Debug Test',
      rating: 5,
      body: 'Great product!',
      status: 'pending',
    });

    const reviews = await api.listReviews();
    const bystatus = {
      pending: reviews.filter(r => r.status === 'pending').length,
      approved: reviews.filter(r => r.status === 'approved').length,
    };

    return {
      total_count: reviews.length,
      by_status: bystatus,
      test_review_id: testReview.id,
      status: '✅',
    };
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔧 Debug Data</h1>

      <div className="grid grid-cols-1 gap-4">
        {/* Environment */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Environment</h2>
            <Button
              onClick={() => runCheck('env', checkEnv)}
              disabled={loading.env}
              size="sm"
            >
              {loading.env ? 'Checking...' : 'Check'}
            </Button>
          </div>
          {errors.env && <Alert className="bg-red-50 border-red-300 text-red-800 mb-4">{errors.env}</Alert>}
          {results.env && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.env, null, 2)}
            </pre>
          )}
        </Card>

        {/* Products */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Products</h2>
            <Button
              onClick={() => runCheck('products', checkProducts)}
              disabled={loading.products}
              size="sm"
            >
              {loading.products ? 'Loading...' : 'Check'}
            </Button>
          </div>
          {errors.products && <Alert className="bg-red-50 border-red-300 text-red-800 mb-4">{errors.products}</Alert>}
          {results.products && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.products, null, 2)}
            </pre>
          )}
        </Card>

        {/* Inventory */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Inventory (adjustStock)</h2>
            <Button
              onClick={() => runCheck('inventory', checkInventory)}
              disabled={loading.inventory}
              size="sm"
            >
              {loading.inventory ? 'Testing...' : 'Test'}
            </Button>
          </div>
          {errors.inventory && <Alert className="bg-red-50 border-red-300 text-red-800 mb-4">{errors.inventory}</Alert>}
          {results.inventory && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.inventory, null, 2)}
            </pre>
          )}
        </Card>

        {/* Specials */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Specials</h2>
            <Button
              onClick={() => runCheck('specials', checkSpecials)}
              disabled={loading.specials}
              size="sm"
            >
              {loading.specials ? 'Checking...' : 'Check'}
            </Button>
          </div>
          {errors.specials && <Alert className="bg-red-50 border-red-300 text-red-800 mb-4">{errors.specials}</Alert>}
          {results.specials && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.specials, null, 2)}
            </pre>
          )}
        </Card>

        {/* Bundles */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Bundles</h2>
            <Button
              onClick={() => runCheck('bundles', checkBundles)}
              disabled={loading.bundles}
              size="sm"
            >
              {loading.bundles ? 'Checking...' : 'Check'}
            </Button>
          </div>
          {errors.bundles && <Alert className="bg-red-50 border-red-300 text-red-800 mb-4">{errors.bundles}</Alert>}
          {results.bundles && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.bundles, null, 2)}
            </pre>
          )}
        </Card>

        {/* Messages */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Messages</h2>
            <Button
              onClick={() => runCheck('messages', checkMessages)}
              disabled={loading.messages}
              size="sm"
            >
              {loading.messages ? 'Testing...' : 'Test'}
            </Button>
          </div>
          {errors.messages && <Alert className="bg-red-50 border-red-300 text-red-800 mb-4">{errors.messages}</Alert>}
          {results.messages && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.messages, null, 2)}
            </pre>
          )}
        </Card>

        {/* Reviews */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Reviews</h2>
            <Button
              onClick={() => runCheck('reviews', checkReviews)}
              disabled={loading.reviews}
              size="sm"
            >
              {loading.reviews ? 'Testing...' : 'Test'}
            </Button>
          </div>
          {errors.reviews && <Alert className="bg-red-50 border-red-300 text-red-800 mb-4">{errors.reviews}</Alert>}
          {results.reviews && (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results.reviews, null, 2)}
            </pre>
          )}
        </Card>
      </div>
    </div>
  );
}
