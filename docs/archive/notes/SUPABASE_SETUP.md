# Supabase Setup Guide

## 1. Environment Variables

Create a `.env` file (or set in Netlify):

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get these from Supabase Dashboard → Settings → API.

## 2. Create Tables in Supabase

Run this SQL in Supabase SQL Editor:

```sql
-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  price_cents INT NOT NULL,
  compare_at_price_cents INT,
  stock_qty INT DEFAULT 0,
  short_desc TEXT,
  overview TEXT,
  features JSONB,
  how_to_use TEXT,
  inci_ingredients JSONB,
  key_ingredients JSONB,
  claims JSONB,
  size TEXT,
  shelf_life TEXT,
  images JSONB,
  hover_image TEXT,
  category_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  delta INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Specials
CREATE TABLE IF NOT EXISTS specials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  ref_id UUID,
  discount_type TEXT NOT NULL,
  value INT NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Bundles
CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft',
  pricing_mode TEXT DEFAULT 'manual',
  discount_value INT,
  price_cents INT NOT NULL,
  compare_at_price_cents INT,
  short_desc TEXT,
  long_desc TEXT,
  images JSONB,
  hover_image TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bundle items
CREATE TABLE IF NOT EXISTS bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES bundles(id),
  product_id UUID NOT NULL REFERENCES products(id),
  qty INT DEFAULT 1,
  UNIQUE(bundle_id, product_id)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  status TEXT DEFAULT 'unpaid',
  payment_status TEXT DEFAULT 'unpaid',
  fulfillment_status TEXT DEFAULT 'pending',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  delivery_method TEXT,
  shipping_address JSONB,
  collection_slot TEXT,
  collection_location TEXT,
  subtotal_cents INT NOT NULL,
  shipping_cents INT DEFAULT 0,
  discount_cents INT DEFAULT 0,
  tax_cents INT DEFAULT 0,
  total_cents INT NOT NULL,
  currency TEXT DEFAULT 'USD',
  tracking_number TEXT,
  tracking_url TEXT,
  notes_admin TEXT,
  placed_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  fulfilled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  variant TEXT,
  qty INT NOT NULL,
  unit_price_cents INT NOT NULL,
  line_total_cents INT NOT NULL
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  amount_cents INT NOT NULL,
  status TEXT DEFAULT 'pending',
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  inquiry_type TEXT DEFAULT 'general',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB,
  status TEXT DEFAULT 'new',
  assignee UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  author_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 3. Enable Row Level Security (Optional but Recommended)

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read on products, specials
CREATE POLICY "Products are public" ON products FOR SELECT USING (true);
CREATE POLICY "Specials are public" ON specials FOR SELECT USING (true);

-- Admin write (add auth later)
CREATE POLICY "Admins manage products" ON products FOR ALL USING (true);
CREATE POLICY "Admins manage orders" ON orders FOR ALL USING (true);
CREATE POLICY "Admins manage messages" ON messages FOR ALL USING (true);
CREATE POLICY "Admins manage reviews" ON reviews FOR ALL USING (true);
```

## 4. Verify Connection Locally

1. Add env vars to `.env`
2. Run `pnpm dev`
3. Open `http://localhost:5173/DebugData`
4. Click each button to test all API methods
5. All should show ✅ 

## 5. Deploy to Netlify

1. In Netlify UI → Site Settings → Environment
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Push to GitHub
4. Deploy should work

## Next Steps

- Add authentication (Supabase Auth + RLS policies)
- Connect webhooks (n8n, Make, etc.)
- Real shipping API integration
- Email notifications
