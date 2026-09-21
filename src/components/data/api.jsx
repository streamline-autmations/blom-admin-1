// Check if we're in development mode

// DataAPI interface - Falls back to adapters when set, or uses direct calls for production
export let api = {
  // 1. Add listContacts to list all customers from the new table
  async listContacts() {
    try {
      const url = '/.netlify/functions/admin-contacts';
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch contact list.");
      return response.json();
    } catch (error) {
      console.warn('Failed to fetch contacts, returning empty array:', error);
      return [];
    }
  },

  // 2. Add getContactDetail to fetch a single customer and related data
  async getContactDetail(userId) {
    try {
      const url = `/.netlify/functions/admin-contact-detail?user_id=${userId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch customer history.");
      return response.json();
    } catch (error) {
      console.warn('Failed to fetch contact detail:', error);
      return null;
    }
  },

  // 3. Delete a contact
  async deleteContact(contactId) {
    try {
      const response = await fetch("/.netlify/functions/admin-contact-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Failed to delete contact");
      }
      
      return result;
    } catch (error) {
      console.error('Failed to delete contact:', error);
      throw error;
    }
  },

  // 3. Adjust Stock
  async adjustStock(payload) {
    try {
      const response = await fetch('/.netlify/functions/adjust-stock', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Update failed');
      return result;
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      throw error;
    }
  },

  // 4. Get Stock Movements
  async listStockMovements() {
    try {
      const response = await fetch('/.netlify/functions/admin-stock-movements');
      const result = await response.json();
      if (!response.ok) throw new Error("Failed to fetch stock movements.");
      return result.data || [];
    } catch (error) {
      console.warn('Failed to fetch stock movements, returning empty array:', error);
      return [];
    }
  },
  
  // Alias for backward compatibility
  async getStockMovements() {
    return this.listStockMovements();
  },

  // 5. List Products - This gets overridden by the adapter
  async listProducts() {
    try {
      console.log('🔍 api.listProducts() called - default fallback');
      console.log('❓ This means the adapter did NOT override this method');
      return [];
    } catch (error) {
      console.warn('⚠️ Failed to fetch products via default fallback:', error);
      return [];
    }
  },

  // 6. List Orders
  async listOrders() {
    try {
      const response = await fetch('/.netlify/functions/admin-orders');
      if (!response.ok) throw new Error("Failed to fetch orders.");
      const result = await response.json();
      return result.ok ? result.data : [];
    } catch (error) {
      console.warn('Failed to fetch orders via Netlify functions, returning empty array:', error);
      return [];
    }
  },

  // 7. List Reviews
  async listReviews(status = 'pending') {
    try {
      const response = await fetch(`/.netlify/functions/admin-reviews?status=${status}`);
      if (!response.ok) throw new Error("Failed to fetch reviews.");
      const result = await response.json();
      return result.ok ? result.data : [];
    } catch (error) {
      console.warn('Failed to fetch reviews via Netlify functions, returning empty array:', error);
      return [];
    }
  },

  // 8. List Bundles
  async listBundles() {
    try {
      const response = await fetch('/.netlify/functions/admin-bundles');
      if (!response.ok) throw new Error("Failed to fetch bundles.");
      const result = await response.json();
      // The admin-bundles function returns data directly, not wrapped in {ok, data}
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.warn('Failed to fetch bundles via Netlify functions, returning empty array:', error);
      return [];
    }
  },

  // 9. Get Top Selling Products (using stock movement logic)
  async getTopSellingProducts(period = 30, limit = 10) {
    try {
      const response = await fetch(`/.netlify/functions/admin-top-selling-products?period=${period}&limit=${limit}`);
      if (!response.ok) throw new Error("Failed to fetch top selling products.");
      const result = await response.json();
      return result.ok ? result.data : { topProducts: [], summary: {} };
    } catch (error) {
      console.warn('Failed to fetch top selling products, returning empty data:', error);
      return { topProducts: [], summary: {} };
    }
  },

  async deleteCoursePurchase(id) {
    const response = await fetch('/.netlify/functions/admin-course-purchase-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Failed to delete course booking');
    }
    return result;
  }
};

export function setAPI(next) {
  console.log('🔧 setAPI called with:', typeof next, next?.listProducts ? 'HAS listProducts' : 'NO listProducts');
  const oldListProducts = api.listProducts;
  api = { ...api, ...next };
  console.log('📊 After setAPI - api.listProducts:', typeof api.listProducts, api.listProducts === oldListProducts ? 'SAME FUNCTION' : 'NEW FUNCTION');
}
