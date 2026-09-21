
const STORAGE_KEY = 'blom.db.v1';

// Initialize global state
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function loadDB() {
  if (window.__BLM_DB) {
    console.log('🔄 Using cached mock database with', window.__BLM_DB.products?.length || 0, 'products');
    return window.__BLM_DB;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      console.log('📁 Loading mock database from localStorage...');
      window.__BLM_DB = JSON.parse(stored);
      // Ensure all dates are correctly parsed if they were serialized as strings
      if (window.__BLM_DB.products) {
        window.__BLM_DB.products.forEach(p => {
          if (p.updated_at && typeof p.updated_at === 'string') p.updated_at = new Date(p.updated_at).toISOString();
        });
      }
      if (window.__BLM_DB.stockMovements) {
        window.__BLM_DB.stockMovements.forEach(m => {
          if (m.created_at && typeof m.created_at === 'string') m.created_at = new Date(m.created_at).toISOString();
        });
      }
      if (window.__BLM_DB.specials) {
        window.__BLM_DB.specials.forEach(s => {
          if (s.starts_at && typeof s.starts_at === 'string') s.starts_at = new Date(s.starts_at).toISOString();
          if (s.ends_at && typeof s.ends_at === 'string') s.ends_at = new Date(s.ends_at).toISOString();
        });
      }
      if (window.__BLM_DB.orders) {
        window.__BLM_DB.orders.forEach(o => {
          if (o.created_at && typeof o.created_at === 'string') o.created_at = new Date(o.created_at).toISOString();
        });
      }
      if (window.__BLM_DB.payments) {
        window.__BLM_DB.payments.forEach(pay => {
          if (pay.created_at && typeof pay.created_at === 'string') pay.created_at = new Date(pay.created_at).toISOString();
        });
      }
      if (window.__BLM_DB.bundles) {
        window.__BLM_DB.bundles.forEach(b => {
          if (b.updated_at && typeof b.updated_at === 'string') b.updated_at = new Date(b.updated_at).toISOString();
        });
      }
      if (window.__BLM_DB.messages) {
        window.__BLM_DB.messages.forEach(m => {
          if (m.created_at && typeof m.created_at === 'string') m.created_at = new Date(m.created_at).toISOString();
          if (m.updated_at && typeof m.updated_at === 'string') m.updated_at = new Date(m.updated_at).toISOString();
        });
      }
      // New: Review date parsing
      if (window.__BLM_DB.reviews) {
        window.__BLM_DB.reviews.forEach(r => {
          if (r.created_at && typeof r.created_at === 'string') r.created_at = new Date(r.created_at).toISOString();
        });
      }
      console.log('✅ Loaded from storage:', window.__BLM_DB.products?.length || 0, 'products,', window.__BLM_DB.bundles?.length || 0, 'bundles');
      return window.__BLM_DB;
    }
  } catch (err) {
    console.warn('❌ Failed to load DB from localStorage:', err);
  }

  // Seed initial data
  console.log('🌱 Seeding fresh mock database with sample data...');
  const seedProducts = [
    {
      id: 'p1',
      name: 'Hydrating Face Cream',
      slug: 'hydrating-face-cream',
      status: 'active',
      price_cents: 34900,
      compare_at_price_cents: 39900,
      stock_qty: 45,
      short_desc: 'Deep hydration for all skin types',
      category_id: null,
      updated_at: new Date().toISOString()
    },
    {
      id: 'p2',
      name: 'Vitamin C Serum',
      slug: 'vitamin-c-serum',
      status: 'active',
      price_cents: 42900,
      compare_at_price_cents: null,
      stock_qty: 3,
      short_desc: 'Brightening and anti-aging serum',
      category_id: null,
      updated_at: new Date().toISOString()
    },
    {
      id: 'p3',
      name: 'Gentle Cleanser',
      slug: 'gentle-cleanser',
      status: 'draft',
      price_cents: 22900,
      compare_at_price_cents: null,
      stock_qty: 120,
      short_desc: 'pH-balanced daily cleanser',
      category_id: null,
      updated_at: new Date().toISOString()
    }
  ];

  const seedOrders = [
    {
      id: 'o1',
      order_number: 'ORD-1001',
      status: 'unpaid',
      total_cents: 77800,
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'o2',
      order_number: 'ORD-1002',
      status: 'paid',
      total_cents: 34900,
      created_at: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  const seedMessages = [
    {
      id: 'm1',
      full_name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+27 82 123 4567',
      inquiry_type: 'order',
      subject: 'Question about order #1001',
      body: 'Hi, I placed an order yesterday but haven\'t received a confirmation email yet. Could you please check on this? My order number is #1001.',
      attachments: [],
      status: 'new',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      assignee: null
    },
    {
      id: 'm2',
      full_name: 'Michael Brown',
      email: 'michael@example.com',
      phone: null,
      inquiry_type: 'shipping',
      subject: 'Shipping to Cape Town',
      body: 'Do you offer free shipping to Cape Town for orders over R500? Also, what\'s the typical delivery time?',
      attachments: [],
      status: 'open',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      assignee: 'admin@example.com'
    },
    {
      id: 'm3',
      full_name: 'Lisa Smith',
      email: 'lisa@example.com',
      phone: '+27 71 987 6543',
      inquiry_type: 'wholesale',
      subject: 'Wholesale pricing inquiry',
      body: 'Hello, I own a beauty salon and I\'m interested in purchasing your products in bulk. Do you offer wholesale pricing? I\'d like to order at least 50 units per month.',
      attachments: [],
      status: 'closed',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      assignee: 'admin@example.com'
    }
  ];

  const seedReviews = [
    {
      id: 'r1',
      product_id: 'p1',
      product_name: 'Hydrating Face Cream',
      author_name: 'Emma Thompson',
      rating: 5,
      title: 'Amazing product!',
      body: 'This face cream has completely transformed my skin. It\'s incredibly hydrating without feeling greasy. Highly recommend!',
      image_url: null,
      status: 'pending',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'r2',
      product_id: 'p2',
      product_name: 'Vitamin C Serum',
      author_name: 'James Wilson',
      rating: 4,
      title: 'Great serum',
      body: 'Been using this for two weeks and I can already see my skin brightening. The only downside is the price, but it\'s worth it.',
      image_url: null,
      status: 'pending',
      created_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 'r3',
      product_id: 'p1',
      product_name: 'Hydrating Face Cream',
      author_name: 'Sophia Martinez',
      rating: 5,
      title: 'Love it!',
      body: 'My skin has never felt better. This cream is perfect for my dry skin and the results are visible within days.',
      image_url: null,
      status: 'approved',
      created_at: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  const seedBundles = [
    {
      id: 'b1',
      name: 'Complete Skincare Bundle',
      slug: 'complete-skincare-bundle',
      status: 'active',
      price_cents: 59900,
      compare_at_price_cents: 77800,
      items: [
        { product_id: 'p1', qty: 1 }, // Hydrating Face Cream
        { product_id: 'p2', qty: 1 }, // Vitamin C Serum
        { product_id: 'p3', qty: 1 }  // Gentle Cleanser
      ],
      short_desc: 'Complete 3-step skincare routine',
      updated_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: 'b2',
      name: 'Anti-Aging Essentials',
      slug: 'anti-aging-essentials',
      status: 'active',
      price_cents: 69900,
      compare_at_price_cents: 84900,
      items: [
        { product_id: 'p1', qty: 1 }, // Hydrating Face Cream
        { product_id: 'p2', qty: 1 }  // Vitamin C Serum
      ],
      short_desc: 'Fight aging with this powerful duo',
      updated_at: new Date(Date.now() - 172800000).toISOString()
    }
  ];

  window.__BLM_DB = {
    products: seedProducts,
    stockMovements: [],
    specials: [],
    bundles: seedBundles,
    orders: seedOrders,
    payments: [],
    messages: seedMessages,
    reviews: seedReviews
  };

  // Clear any existing data and reseed for fresh start
  localStorage.removeItem(STORAGE_KEY);

  saveDB();
  return window.__BLM_DB;
}

function saveDB() {
  if (!window.__BLM_DB) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.__BLM_DB));
  } catch (err) {
    console.error('Failed to save DB to localStorage:', err);
  }
}

function computeBundleBase(items, products) {
  let total = 0;
  items.forEach(item => {
    const product = products.find(p => p.id === item.product_id);
    if (product) {
      total += product.price_cents * item.qty;
    }
  });
  return total;
}

function suggestBundlePrice(base, mode, value) {
  if (mode === 'manual') return base;
  if (mode === 'percent_off') {
    return Math.max(1, Math.round(base * (1 - value / 100)));
  }
  if (mode === 'amount_off') {
    return Math.max(1, Math.round(base - value * 100));
  }
  return base;
}

export function createMockAdapter() {
  return {
    async listCourses() {
      await new Promise(resolve => setTimeout(resolve, 0));
      return [];
    },

    async getCourse(_id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return null;
    },

    async upsertCourse(course) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return { ...course, id: course?.id || generateId() };
    },

    async listProducts() {
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log('📦 MockAdapter: listProducts() called');
      const db = loadDB();
      const products = [...db.products].sort((a, b) => 
        (b.updated_at || '').localeCompare(a.updated_at || '')
      );
      console.log('📦 MockAdapter: Returning', products.length, 'products:', products.map(p => p.name));
      return products;
    },

    async getProduct(id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return db.products.find(p => p.id === id) || null;
    },

    async upsertProduct(p) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();

      if (p.id) {
        // Update existing
        const index = db.products.findIndex(prod => prod.id === p.id);
        if (index >= 0) {
          const oldProduct = db.products[index];
          const updated = { ...oldProduct, ...p, updated_at: now };
          
          // Track stock changes
          if (p.stock_qty !== undefined && p.stock_qty !== oldProduct.stock_qty) {
            const delta = p.stock_qty - oldProduct.stock_qty;
            const movement = {
              id: generateId(),
              product_id: p.id,
              delta,
              reason: 'manual edit',
              created_at: now
            };
            db.stockMovements.push(movement);
          }
          
          db.products[index] = updated;
          saveDB();
          return updated;
        }
      }

      // Create new
      const newProduct = {
        id: p.id || generateId(),
        name: p.name || 'New Product',
        slug: p.slug || 'new-product',
        status: p.status || 'draft',
        price_cents: p.price_cents || 0,
        compare_at_price_cents: p.compare_at_price_cents,
        stock_qty: p.stock_qty || 0,
        short_desc: p.short_desc,
        category_id: p.category_id,
        updated_at: now
      };
      
      db.products.push(newProduct);
      saveDB();
      return newProduct;
    },

    // Partial update - only updates specified fields, preserves all others
    async partialUpdateProduct(p) {
      if (!p.id) {
        throw new Error('partialUpdateProduct requires product id');
      }

      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();
      const index = db.products.findIndex(prod => prod.id === p.id);

      if (index < 0) {
        throw new Error(`Product ${p.id} not found`);
      }

      const oldProduct = db.products[index];
      const updated = { ...oldProduct, updated_at: now };

      // Only update fields that are explicitly provided (not undefined)
      if (p.name !== undefined) updated.name = p.name;
      if (p.slug !== undefined) updated.slug = p.slug;
      if (p.status !== undefined) updated.status = p.status;
      if (p.price_cents !== undefined) updated.price_cents = p.price_cents;
      if (p.compare_at_price_cents !== undefined) updated.compare_at_price_cents = p.compare_at_price_cents;
      if (p.stock_qty !== undefined) {
        const delta = p.stock_qty - oldProduct.stock_qty;
        if (delta !== 0) {
          const movement = {
            id: generateId(),
            product_id: p.id,
            delta,
            reason: 'partial edit',
            created_at: now
          };
          db.stockMovements.push(movement);
        }
        updated.stock_qty = p.stock_qty;
      }
      if (p.short_desc !== undefined) updated.short_desc = p.short_desc;
      if (p.category_id !== undefined) updated.category_id = p.category_id;

      db.products[index] = updated;
      saveDB();
      return updated;
    },

    async listCoursePurchases(filters) {
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log('📦 MockAdapter: listCoursePurchases() called with', filters);
      return { items: [], total: 0, page: 1, pageSize: 20 };
    },

    async listCoursePurchasesByCourse(course_slug) {
       return this.listCoursePurchases({ course_slug });
    },

    async getCoursePurchase(_id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return null;
    },

    async listStockMovements(limit) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const sorted = [...db.stockMovements].sort((a, b) => 
        b.created_at.localeCompare(a.created_at)
      );
      return limit ? sorted.slice(0, limit) : sorted;
    },

    async adjustStock(product_id, delta, reason) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();

      const product = db.products.find(p => p.id === product_id);
      if (!product) {
        throw new Error('Product not found');
      }

      // Create movement
      const movement = {
        id: generateId(),
        product_id,
        delta,
        reason: reason || null,
        created_at: now
      };
      db.stockMovements.push(movement);

      // Update product stock
      product.stock_qty = Math.max(0, product.stock_qty + delta);
      product.updated_at = now;

      saveDB();
      return { product, movement };
    },

    async listSpecials() {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return [...db.specials];
    },

    async upsertSpecial(s) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();

      if (s.id) {
        const index = db.specials.findIndex(sp => sp.id === s.id);
        if (index >= 0) {
          const updated = { ...db.specials[index], ...s };
          db.specials[index] = updated;
          saveDB();
          return updated;
        }
      }

      const newSpecial = {
        id: s.id || generateId(),
        scope: s.scope || 'product',
        ref_id: s.ref_id,
        discount_type: s.discount_type || 'percent',
        value: s.value || 0,
        starts_at: s.starts_at || new Date().toISOString(),
        ends_at: s.ends_at,
        status: s.status || 'scheduled'
      };

      db.specials.push(newSpecial);
      saveDB();
      return newSpecial;
    },

    async listBundles() {
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log('📦 MockAdapter: listBundles() called');
      const db = loadDB();
      const bundles = [...db.bundles].sort((a, b) => 
        (b.updated_at || '').localeCompare(a.updated_at || '')
      );
      console.log('📦 MockAdapter: Returning', bundles.length, 'bundles:', bundles.map(b => b.name));
      return bundles;
    },

    async getBundle(id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return db.bundles.find(b => b.id === id) || null;
    },

    async upsertBundle(b) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();

      // Auto-generate slug if needed
      let slug = b.slug;
      if (!slug && b.name) {
        slug = b.name.toLowerCase().trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        
        // Ensure unique slug
        let uniqueSlug = slug;
        let counter = 1;
        while (db.bundles.some(bundle => bundle.slug === uniqueSlug && bundle.id !== b.id)) {
          uniqueSlug = `${slug}-${counter}`;
          counter++;
        }
        slug = uniqueSlug;
      }

      if (b.id) {
        // Update existing
        const index = db.bundles.findIndex(bundle => bundle.id === b.id);
        if (index >= 0) {
          const updated = {
            ...db.bundles[index],
            ...b,
            slug,
            updated_at: now
          };
          // Ensure items is completely replaced if provided
          if (b.items) updated.items = b.items; 
          db.bundles[index] = updated;
          saveDB();
          return updated;
        }
      }

      // Create new
      const newBundle = {
        id: b.id || generateId(),
        name: b.name || 'New Bundle',
        slug: slug, // Use the generated/provided slug
        status: b.status || 'draft',
        items: b.items || [],
        pricing_mode: b.pricing_mode || 'manual', // New field
        discount_value: b.discount_value !== undefined ? b.discount_value : null, // New field, allow 0
        price_cents: b.price_cents || 0,
        compare_at_price_cents: b.compare_at_price_cents !== undefined ? b.compare_at_price_cents : null, // Allow null
        short_desc: b.short_desc !== undefined ? b.short_desc : null, // New field, allow null
        long_desc: b.long_desc !== undefined ? b.long_desc : null, // New field, allow null
        images: b.images || [], // New field
        hover_image: b.hover_image !== undefined ? b.hover_image : null, // New field, allow null
        updated_at: now
      };

      db.bundles.push(newBundle);
      saveDB();
      return newBundle;
    },

    computeBundleBase(items) {
      const db = loadDB();
      return computeBundleBase(items, db.products);
    },

    suggestBundlePrice(base, mode, value) {
      return suggestBundlePrice(base, mode, value);
    },

    async listOrders() {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return [...db.orders].sort((a, b) => 
        b.created_at.localeCompare(a.created_at)
      );
    },

    async getOrder(id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return db.orders.find(o => o.id === id) || null;
    },

    async markOrderPaid(id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();

      const order = db.orders.find(o => o.id === id);
      if (!order) {
        throw new Error('Order not found');
      }

      order.status = 'paid';

      const payment = {
        id: generateId(),
        order_id: id,
        provider: 'manual',
        amount_cents: order.total_cents,
        status: 'succeeded',
        created_at: now,
        raw: {}
      };

      db.payments.push(payment);
      saveDB();

      return { order, payment };
    },

    async listPayments() {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return [...db.payments].sort((a, b) => 
        b.created_at.localeCompare(a.created_at)
      );
    },

    async listMessages() {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return [...db.messages].sort((a, b) => 
        b.created_at.localeCompare(a.created_at)
      );
    },

    async getMessage(id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return db.messages.find(m => m.id === id) || null;
    },

    async createMessage(m) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();

      const newMessage = {
        id: m.id || generateId(),
        full_name: m.full_name,
        email: m.email,
        phone: m.phone || null,
        inquiry_type: m.inquiry_type || 'general',
        subject: m.subject,
        body: m.body,
        attachments: m.attachments || [],
        status: m.status || 'new',
        created_at: now,
        updated_at: now,
        assignee: m.assignee || null
      };

      db.messages.push(newMessage);
      saveDB();
      return newMessage;
    },

    async updateMessage(id, patch) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();

      const index = db.messages.findIndex(m => m.id === id);
      if (index < 0) {
        throw new Error('Message not found');
      }

      const updated = {
        ...db.messages[index],
        ...patch,
        updated_at: now
      };

      db.messages[index] = updated;
      saveDB();
      return updated;
    },

    async listReviews(status) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      let reviews = [...db.reviews];
      if (status) {
        reviews = reviews.filter(r => r.status === status);
      }
      return reviews.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async getReview(id) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      return db.reviews.find(r => r.id === id) || null;
    },

    async createReview(r) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const now = new Date().toISOString();

      const newReview = {
        id: r.id || generateId(),
        product_id: r.product_id,
        product_name: r.product_name || null,
        author_name: r.author_name,
        rating: r.rating,
        title: r.title || null,
        body: r.body,
        image_url: r.image_url || null,
        status: r.status || 'pending',
        created_at: now
      };

      db.reviews.push(newReview);
      saveDB();
      return newReview;
    },

    async updateReview(id, patch) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();

      const index = db.reviews.findIndex(r => r.id === id);
      if (index < 0) {
        throw new Error('Review not found');
      }

      const updated = {
        ...db.reviews[index],
        ...patch
      };

      db.reviews[index] = updated;
      saveDB();
      return updated;
    },

    async estimateShipping(_params) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock shipping rates
      return [
        {
          service: 'Door-to-Door',
          eta: '1-3 days',
          cost_cents: 5900
        },
        {
          service: 'Locker',
          eta: '1-2 days',
          cost_cents: 4900
        }
      ];
    },

    // Additional methods for API compatibility
    async listContacts() {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      // Convert messages to contacts format
      return db.messages.map(msg => ({
        id: msg.id,
        full_name: msg.full_name,
        email: msg.email,
        phone: msg.phone,
        inquiry_type: msg.inquiry_type,
        subject: msg.subject,
        status: msg.status,
        created_at: msg.created_at
      }));
    },

    async getContactDetail(userId) {
      await new Promise(resolve => setTimeout(resolve, 0));
      const db = loadDB();
      const contact = db.messages.find(m => m.id === userId);
      if (!contact) return null;
      
      // Return contact detail in expected format
      return {
        contact,
        orders: db.orders.filter(o => o.contact_id === userId || o.email === contact.email),
        messages: [contact]
      };
    },

    // Alias for backward compatibility
    async getStockMovements() {
      return this.listStockMovements();
    }
  };
}

// Helper for webhook intake (future use)
export function receiveMessage(payload) {
  const adapter = createMockAdapter();
  return adapter.createMessage({
    full_name: payload.full_name || payload.name || 'Anonymous',
    email: payload.email,
    phone: payload.phone || null,
    inquiry_type: payload.inquiry_type || 'general',
    subject: payload.subject || 'No Subject',
    body: payload.body || payload.message || '',
    attachments: payload.attachments || [],
    status: 'new',
    assignee: null
  });
}
