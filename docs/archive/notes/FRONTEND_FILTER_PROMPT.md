# Frontend Product Filter Fix - Prompt for Website Repository

## Issue
Your frontend website is showing draft and archived products that should only be visible in the admin panel, not to customers.

## Solution
Update your frontend product queries to filter out draft and archived products. Here are the exact changes needed:

## 1. Find Your Product Queries
Look for places in your frontend code where you fetch products. Common locations:
- `api.js` or similar API files
- Product listing components
- Home page/product grid components
- Search results
- Category pages

## 2. Update Product Queries
**BEFORE (showing all products):**
```javascript
// This might be showing draft and archived products
const { data: products } = await supabase
  .from('products')
  .select('*')
  .order('name');
```

**AFTER (show only active products):**
```javascript
// Filter to only show active products to customers
const { data: products } = await supabase
  .from('products')
  .select('*')
  .eq('status', 'active')
  .order('name');
```

## 3. Alternative Filtering Options
If your products use `is_active` field instead of `status`:

**If using `is_active` field:**
```javascript
const { data: products } = await supabase
  .from('products')
  .select('*')
  .eq('is_active', true)
  .order('name');
```

## 4. Multiple Filtering Conditions
If you need to filter out multiple non-customer-facing statuses:

**Filter out draft and archived:**
```javascript
const { data: products } = await supabase
  .from('products')
  .select('*')
  .neq('status', 'draft')
  .neq('status', 'archived')
  .order('name');
```

## 5. Specific Files to Check
Look for these patterns in your codebase:

**Search for these strings:**
- `from('products')` - Find all product queries
- `products.*select` - Find product selection queries
- `.order('name')` - Find ordered product queries

## 6. Complete Example
Here's a complete example of a product listing component:

```javascript
// In your products listing component
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ProductListing() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        // Only fetch active products for customers
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'active')  // Only show active products
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  if (loading) return <div>Loading products...</div>;

  return (
    <div className="products-grid">
      {products.map(product => (
        <div key={product.id} className="product-card">
          <h3>{product.name}</h3>
          <p>{product.price}</p>
          {/* ... other product details ... */}
        </div>
      ))}
    </div>
  );
}
```

## 7. Testing
After making these changes:
1. Check that draft products are not visible on your website
2. Check that archived products are not visible on your website  
3. Verify that active products still show correctly
4. Test category pages, search results, and home page grids

## 8. Migration Strategy
If you have many files to update, use find/replace in your code editor:
- Search: `from('products')` 
- Replace with: `from('products').eq('status', 'active')`

## Result
Your website will only show products that are marked as 'active', keeping draft and archived products hidden from customers while still visible in the admin panel for management.

## Need Help?
If you encounter issues:
1. Check that your `status` field matches your database schema (might be `is_active` boolean)
2. Verify your Supabase RLS policies allow the frontend to read active products
3. Test with different product statuses to ensure filtering works correctly