# 🔥 Schema Modification Guide - FULL ADMIN ACCESS

With the **SERVICE ROLE KEY**, I have complete control over your Supabase database!

---

## ✅ CONFIRMED ACCESS LEVEL

**Service Role Key Active**: Yes
**RLS Bypass**: Yes
**Schema Modifications**: Yes
**Full Admin Rights**: Yes

---

## 🛠️ What I Can Do Now

### 1. **Add Columns to Existing Tables**

**Example: Add SEO fields to products**

```sql
ALTER TABLE products
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];
```

**Example: Add timestamps**

```sql
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

---

### 2. **Create New Tables**

**Example: Product Categories**

```sql
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id),
  image_url TEXT,
  display_order INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
```

---

### 3. **Create Indexes for Performance**

```sql
-- Speed up common queries
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_email ON orders(buyer_email);

-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_products_status_created ON products(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
```

---

### 4. **Add Constraints**

```sql
-- Ensure positive prices
ALTER TABLE products
ADD CONSTRAINT check_positive_price CHECK (price >= 0);

-- Ensure valid stock quantities
ALTER TABLE products
ADD CONSTRAINT check_non_negative_stock CHECK (stock >= 0);

-- Ensure valid ratings
ALTER TABLE product_reviews
ADD CONSTRAINT check_rating_range CHECK (rating BETWEEN 1 AND 5);
```

---

### 5. **Create Database Views**

**Example: Active Products View**

```sql
CREATE OR REPLACE VIEW v_active_products AS
SELECT
  id,
  name,
  slug,
  price,
  stock,
  short_description,
  image_url,
  created_at
FROM products
WHERE status = 'active' AND stock > 0
ORDER BY created_at DESC;
```

**Example: Low Stock Alert View**

```sql
CREATE OR REPLACE VIEW v_low_stock_products AS
SELECT
  id,
  name,
  slug,
  price,
  stock,
  status
FROM products
WHERE stock < 10 AND status = 'active'
ORDER BY stock ASC;
```

**Example: Sales Summary View**

```sql
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT
  DATE(created_at) as sale_date,
  COUNT(*) as order_count,
  SUM(total) as revenue,
  AVG(total) as avg_order_value
FROM orders
WHERE status IN ('paid', 'packed', 'delivered')
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;
```

---

### 6. **Create Database Functions**

**Example: Get Low Stock Products**

```sql
CREATE OR REPLACE FUNCTION get_low_stock_products(threshold INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  stock INT,
  price DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.slug, p.stock, p.price
  FROM products p
  WHERE p.stock < threshold AND p.status = 'active'
  ORDER BY p.stock ASC;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Example: Calculate Total Revenue**

```sql
CREATE OR REPLACE FUNCTION calculate_revenue(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(total), 0)
  INTO total
  FROM orders
  WHERE created_at BETWEEN start_date AND end_date
    AND status IN ('paid', 'packed', 'delivered');

  RETURN total;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

### 7. **Create/Modify RLS Policies**

**Example: Allow public to read active products**

```sql
-- Drop old policy if exists
DROP POLICY IF EXISTS "public_read_active_products" ON products;

-- Create new policy
CREATE POLICY "public_read_active_products"
ON products
FOR SELECT
TO anon, authenticated
USING (status = 'active');
```

**Example: Allow authenticated users to create reviews**

```sql
DROP POLICY IF EXISTS "authenticated_create_reviews" ON product_reviews;

CREATE POLICY "authenticated_create_reviews"
ON product_reviews
FOR INSERT
TO authenticated
WITH CHECK (true);
```

**Example: Admin can do everything**

```sql
DROP POLICY IF EXISTS "service_role_all_products" ON products;

CREATE POLICY "service_role_all_products"
ON products
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

### 8. **Create Triggers**

**Example: Auto-update updated_at timestamp**

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to products table
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to bundles table
DROP TRIGGER IF EXISTS update_bundles_updated_at ON bundles;
CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Example: Auto-update stock on order**

```sql
CREATE OR REPLACE FUNCTION update_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS decrease_stock_on_order ON order_items;
CREATE TRIGGER decrease_stock_on_order
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_order();
```

---

### 9. **Bulk Data Operations**

**Update all draft products to active:**

```bash
# Using the admin API
curl -X PATCH \
  -H "apikey: SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}' \
  "https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/products?status=eq.draft"
```

**Delete all products with price 0:**

```bash
curl -X DELETE \
  -H "apikey: SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  "https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/products?price=eq.0"
```

---

### 10. **Enable Full-Text Search**

```sql
-- Add tsvector column for search
ALTER TABLE products
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create index for fast searching
CREATE INDEX IF NOT EXISTS idx_products_search
ON products USING GIN(search_vector);

-- Create trigger to auto-update search vector
CREATE OR REPLACE FUNCTION products_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.long_description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();

-- Update existing products
UPDATE products SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(short_description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(long_description, '')), 'C');
```

---

## 🎯 How to Execute These Commands

### Method 1: Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/yvmnedjybrpvlupygusf/editor
2. Click "SQL Editor"
3. Paste SQL and click "Run"

### Method 2: Via psql (if you have database connection string)

```bash
psql "postgresql://postgres:[password]@db.yvmnedjybrpvlupygusf.supabase.co:5432/postgres" -c "YOUR SQL HERE"
```

### Method 3: Via Netlify Function (for programmatic access)

I've created `netlify/functions/admin-db-operation.ts` that uses the service role key.

### Method 4: Tell Me What You Want

Just say:
- "Add a seo_title column to products"
- "Create a categories table"
- "Add an index on orders.status"
- "Create a view for low stock products"

And I'll execute it for you!

---

## 🚨 Safety Notes

**The service role key bypasses ALL security:**
- RLS policies don't apply
- Can modify schema
- Can delete anything
- Keep it secret!

**Best practices:**
- Only use for admin operations
- Don't expose in client-side code
- Keep in environment variables only
- Rotate regularly

---

## 🎉 Ready to Modify Your Database!

**What do you want to do?**

Examples:
- "Add categories support to products"
- "Create an orders dashboard view"
- "Add full-text search to products"
- "Create a low stock alert system"
- "Add SEO fields to products"
- "Create admin analytics functions"

**I'm ready! Just tell me what you need!** 🚀
