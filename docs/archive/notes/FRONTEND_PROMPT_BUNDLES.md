# Frontend Developer Update: Bundle & Category Consolidation

## **Context**
We have consolidated all Bundles and Collections into a single category: **"Bundle Deals"**.
Previously, we had separate logic for "Collections" vs "Bundles". This distinction is now purely internal (for badge/display logic) but **all** of them must live under the `Bundle Deals` category in the database and on the storefront.

## **Changes Made in Admin**
1.  **Unified Category**: Both `BundleNew` and `BundleEdit` forms now hardcode the `category` field to `'Bundle Deals'` upon saving, regardless of whether the user selects "Collection" or "Bundle" type.
2.  **Image Deduplication**: The admin now automatically deduplicates images in the gallery and ensures the main thumbnail is not repeated in the gallery list.
3.  **Overview Fallback**: If the "Overview" field is empty, it falls back to "Short Description" to ensure the frontend always has content to display.

## **Required Frontend Updates**
Please ensure the Storefront (customer-facing site) reflects these changes:

### 1. Navigation & Filtering
*   **Menu Update**: If you have separate menu items for "Collections" and "Bundles", please **merge them** into a single "Bundle Deals" link.
    *   *Link*: `/collections/bundle-deals` (or whatever your category route is).
*   **Category Filter**: Ensure your product listing pages filter by `category = 'Bundle Deals'`. Do **not** try to filter by `category = 'Collections'` anymore, as that category is being deprecated/merged.

### 2. Product Page Template
*   **Overview Display**: Ensure your product detail page handles the `overview` field. If `overview` is empty, please fallback to displaying `short_description`.
    ```javascript
    const descriptionToDisplay = product.overview || product.short_description;
    ```
*   **Gallery Logic**: The admin now sends a clean list of `gallery_urls`. You no longer need to manually merge `thumbnail_url` into the gallery list on the frontend if you were doing so, OR if you were doing it, ensure you check for duplicates. Ideally, rely on the `images` array provided by the API if available.

### 3. "Collection" vs "Bundle" Display
*   We still store `product_type` as 'bundle' or 'collection'.
*   You can use this field if you want to display a different badge (e.g., "Collection" vs "Bundle Value"), but **both** should appear on the same "Bundle Deals" listing page.

## **Verification Checklist**
- [ ] Go to the "Bundle Deals" page on the site.
- [ ] Verify that products previously labeled "Collections" (like 'Red Collection') are visible there.
- [ ] Open a product page. Verify images are not duplicated.
- [ ] Verify description text is visible even for older products (fallback logic).
