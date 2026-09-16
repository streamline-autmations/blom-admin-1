# Frontend Developer Update: Product Deletion & Visibility

## **Context**
We have implemented a "Soft Delete" mechanism for products and bundles that cannot be permanently deleted due to existing orders (foreign key constraints).
Instead of returning an error or archiving them (which leaves them visible in some views), we now set their `status` to `'deleted'`.

## **Required Updates**

### 1. Global Product Filtering
*   **API/Query Update**: Ensure that **ALL** product and bundle fetch queries filter out items where `status === 'deleted'`.
*   **Search/Listing**: These items should **NEVER** appear in search results, category listings, or "All Products" views.

### 2. Product Detail Pages
*   **404 Handling**: If a user tries to navigate to a product page for a product that has `status: 'deleted'`, the page should render a **404 Not Found** (or redirect to the home/shop page). It should behave exactly as if the record does not exist.

### 3. Cart & Checkout
*   **Validation**: Ensure that if a user somehow has a 'deleted' item in their cart (e.g., from an old session), it is flagged as unavailable or removed during the checkout validation process.

## **Summary**
From a frontend perspective, `status: 'deleted'` is equivalent to the record not existing. Please ensure these items are completely invisible to the customer.
