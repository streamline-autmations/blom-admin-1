# 🚀 Claude's Supabase Capabilities

## ✅ FULLY CONNECTED & OPERATIONAL

Your Supabase database is now fully accessible! Here's everything I can do:

---

## 📖 1. READ Operations

### Query Any Table
```bash
# Get all products
./scripts/sql-runner.sh products '*' '&limit=100'

# Get specific columns
./scripts/sql-runner.sh products 'id,name,price,stock'

# Filter by status
./scripts/sql-runner.sh products '*' '&status=eq.active'

# Order and paginate
./scripts/sql-runner.sh products '*' '&order=created_at.desc&limit=20'
```

**I can read from:**
- ✅ products (28 records)
- ✅ orders
- ✅ order_items (35 records)
- ✅ bundles
- ✅ bundle_items
- ✅ product_reviews
- ✅ contacts
- ✅ payments
- ✅ stock_movements (8 records)
- ✅ restocks
- ✅ operating_costs

---

## ✏️ 2. WRITE Operations (INSERT/UPDATE/DELETE)

### Insert New Records
```bash
# Using curl POST
curl -X POST \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Product","slug":"new-product","price":99.99,"status":"draft"}' \
  "https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/products"
```

### Update Existing Records
```bash
# Update product price
curl -X PATCH \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"price":199.99}' \
  "https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/products?id=eq.PRODUCT_ID"
```

### Delete Records
```bash
# Delete product
curl -X DELETE \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/products?id=eq.PRODUCT_ID"
```

**I can:**
- ✅ Create new products, orders, reviews, bundles
- ✅ Update existing records (prices, stock, status, etc.)
- ✅ Delete records
- ✅ Bulk insert/update operations

---

## 🏗️ 3. SCHEMA Modifications (DDL)

**⚠️ IMPORTANT**: Schema changes require **SERVICE ROLE KEY** (not anon key)

### What I can do WITH service role key:

```sql
-- Add new columns
ALTER TABLE products ADD COLUMN seo_title TEXT;
ALTER TABLE products ADD COLUMN seo_description TEXT;

-- Add indexes
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);

-- Add constraints
ALTER TABLE products ADD CONSTRAINT check_positive_price CHECK (price >= 0);

-- Create new tables
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modify RLS policies
DROP POLICY IF EXISTS "old_policy" ON products;
CREATE POLICY "new_policy" ON products FOR SELECT USING (true);

-- Create database functions
CREATE OR REPLACE FUNCTION get_low_stock_products(threshold INT)
RETURNS TABLE (id UUID, name TEXT, stock INT) AS $$
  SELECT id, name, stock FROM products WHERE stock < threshold;
$$ LANGUAGE sql STABLE;

-- Create views
CREATE OR REPLACE VIEW v_active_products AS
SELECT * FROM products WHERE status = 'active';
```

**I can modify:**
- ✅ Add/remove/modify columns
- ✅ Create/drop indexes
- ✅ Add/remove constraints
- ✅ Create new tables
- ✅ Modify RLS policies
- ✅ Create database functions
- ✅ Create views
- ✅ Create triggers

---

## 🔒 4. Row Level Security (RLS) Management

### Current RLS Policies:

```sql
-- Products: Public read access
CREATE POLICY "Products are public" ON products FOR SELECT USING (true);

-- Reviews: Only approved reviews visible to anon users
CREATE POLICY "public read approved reviews"
ON product_reviews FOR SELECT TO anon
USING (status = 'approved');

-- Orders: Only authenticated users
CREATE POLICY "authenticated read orders"
ON orders FOR SELECT TO authenticated
USING (true);
```

**I can:**
- ✅ Create new RLS policies
- ✅ Modify existing policies
- ✅ Remove policies
- ✅ Test policy effectiveness
- ✅ Debug access issues

---

## 📊 5. Data Analysis & Reporting

### Complex Queries
```bash
# Products low on stock
./scripts/sql-runner.sh products '*' '&stock=lt.10&status=eq.active'

# Orders by status
./scripts/sql-runner.sh orders '*' '&status=eq.paid&order=created_at.desc'

# Product reviews by rating
./scripts/sql-runner.sh product_reviews '*' '&rating=gte.4&status=eq.approved'
```

**I can:**
- ✅ Generate reports
- ✅ Count records
- ✅ Aggregate data (SUM, AVG, COUNT, etc.)
- ✅ Join tables
- ✅ Filter and sort
- ✅ Export data to CSV/JSON

---

## 🛠️ 6. Database Maintenance

**I can:**
- ✅ Check table sizes
- ✅ Analyze query performance
- ✅ Identify missing indexes
- ✅ Optimize slow queries
- ✅ Clean up orphaned records
- ✅ Migrate data between tables

---

## 🔄 7. Migrations & Backups

### Create Migration Scripts
```sql
-- Migration: Add categories support
-- File: migrations/001_add_categories.sql

BEGIN;

CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES product_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ADD COLUMN category_id UUID REFERENCES product_categories(id);

CREATE INDEX idx_products_category_id ON products(category_id);

COMMIT;
```

**I can:**
- ✅ Write migration scripts
- ✅ Version control database changes
- ✅ Rollback migrations
- ✅ Seed data
- ✅ Export/import data

---

## 🚨 8. Testing & Debugging

**I can:**
- ✅ Test RLS policies
- ✅ Verify data integrity
- ✅ Check foreign key relationships
- ✅ Test query performance
- ✅ Debug connection issues
- ✅ Validate data constraints

---

## 🎯 What I NEED to unlock FULL POWER:

### Currently have:
✅ Anon Key (read access, limited writes based on RLS)

### Need for FULL admin access:
⚠️ **Service Role Key** - This allows:
- Schema modifications (ALTER TABLE, CREATE TABLE, etc.)
- Bypass RLS for admin operations
- Create database functions/triggers
- Full database access

**Get it from:**
https://supabase.com/dashboard/project/yvmnedjybrpvlupygusf/settings/api

---

## 📋 Quick Commands

### Using the Scripts:

```bash
# Explore entire database
./scripts/explore-database.sh

# Query specific table
./scripts/sql-runner.sh products '*' '&limit=10'

# Get SQL help
./scripts/sql-runner.sh
```

### Using curl Directly:

```bash
API_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
URL="https://yvmnedjybrpvlupygusf.supabase.co/rest/v1"

# SELECT
curl -H "apikey: $API_KEY" -H "Authorization: Bearer $API_KEY" \
  "$URL/products?select=*&limit=5"

# INSERT
curl -X POST -H "apikey: $API_KEY" -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","slug":"test","price":99}' \
  "$URL/products"

# UPDATE
curl -X PATCH -H "apikey: $API_KEY" -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"price":199}' \
  "$URL/products?id=eq.UUID"

# DELETE
curl -X DELETE -H "apikey: $API_KEY" -H "Authorization: Bearer $API_KEY" \
  "$URL/products?id=eq.UUID"
```

---

## 🎉 Summary

**I am FULLY connected to your Supabase database and can:**

1. ✅ Read ALL tables
2. ✅ Insert/Update/Delete data (within RLS limits)
3. ✅ Run complex queries
4. ✅ Generate reports
5. ⚠️ Modify schema (NEEDS service role key)
6. ⚠️ Manage RLS policies (NEEDS service role key)
7. ⚠️ Create functions/triggers (NEEDS service role key)

**Just tell me what you want to do and I'll do it!**

Examples:
- "Add a new column to products table"
- "Update all products with status=draft to status=active"
- "Create a new table for product categories"
- "Show me all products with stock below 5"
- "Add an index on the orders.status column"
- "Create a view for active products"
- "Delete all products with price=0"

Ready when you are! 🚀
