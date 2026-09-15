import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler: Handler = async (e) => {
  // Add early check for missing env vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables" })
    };
  }

  try {
    url = new URL(e.rawUrl);
    const orderId = url.searchParams.get("order_id");

    // Handle individual order query
    if (orderId) {
      const { data: order, error: orderError } = await s.from("orders")
        .select(`
          *,
          invoice_url,
          order_items (
            id,
            name,
            product_name,
            quantity,
            unit_price_cents,
            line_total_cents,
            price,
            unit_price,
            line_total,
            variant,
            sku,
            product_id
          )
        `)
        .eq("id", orderId)
        .single();

      if (orderError) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ ok: false, error: "Order not found" })
        };
      }

      // Determine invoice information
      const hasInvoice = !!order.invoice_url;
      const canGenerateInvoice = order.status === 'paid' || order.payment_status === 'paid';
      const needsManualGeneration = !hasInvoice && canGenerateInvoice;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          ok: true,
          order: {
            ...order,
            buyer_name: order.buyer_name || order.customer_name,
            buyer_email: order.buyer_email || order.customer_email,
            contact_phone: order.contact_phone || order.customer_phone
          },
          invoice_info: {
            has_invoice: hasInvoice,
            invoice_url: order.invoice_url,
            can_generate_invoice: canGenerateInvoice,
            needs_manual_generation: needsManualGeneration
          }
        })
      };
    }

    // Ensure archived column exists
    try {
      // Try to select from orders with archived column to check if it exists
      await s.from("orders").select("archived").limit(1);
    } catch (error) {
      // Column doesn't exist, try to add it
      console.log("Archived column missing, adding it...");
      try {
        // Use raw SQL via Supabase client
        const { error: alterError } = await s.rpc('exec', {
          query: `
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
            CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived);
          `
        });
        if (alterError) {
          console.log("RPC failed, trying direct SQL execution...");
          // If RPC doesn't work, we'll handle it in the query
        }
      } catch (rpcError) {
        console.log("Migration attempt failed:", rpcError.message);
      }
    }

    // Detect order_kind column (for separating course vs product orders)
    let hasOrderKind = true;
    try {
      await s.from("orders").select("order_kind").limit(1);
    } catch {
      hasOrderKind = false;
    }

    url = new URL(e.rawUrl);
    const page = Number(url.searchParams.get("page") || 1);
    const size = Math.min(Number(url.searchParams.get("size") || 20), 100);
    const status = url.searchParams.get("status") || "";
    const fulfillment = url.searchParams.get("fulfillment") || "";
    const view = (url.searchParams.get("view") || "paid").toLowerCase();
    const search = (url.searchParams.get("search") || "").trim();
    const from = (page - 1) * size;
    const to = from + size - 1;

    const baseSelect = "id,order_number,m_payment_id,merchant_payment_id,buyer_name,buyer_email,contact_phone,status,payment_status,total_cents,created_at,placed_at,paid_at,fulfillment_type,fulfillment_method,shipping_method,customer_name,customer_email,customer_phone,shipping_address,delivery_method,collection_slot,collection_location,subtotal_cents,shipping_cents,discount_cents,archived,invoice_url";
    const selectCols = hasOrderKind ? `${baseSelect},order_kind` : baseSelect;

    let query = s.from("orders")
      .select(selectCols, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    // Payment view. Default is unchanged (paid only) so nothing regresses.
    //
    // 'unpaid' exists because orders that never settle are otherwise invisible on
    // every page of this list even though they are in the database: EFT customers
    // who abandon checkout and pay by bank transfer, and card/Payflex payments
    // whose callback never lands. Two real payments (R570 + R575) sat unseen for
    // days in Aug 2026 before anyone noticed.
    const SETTLED_STATUSES = 'paid,packed,collected,out_for_delivery,delivered';
    if (view === 'unpaid') {
      query = query
        .or('payment_status.is.null,payment_status.neq.paid')
        .or(`status.is.null,status.not.in.(${SETTLED_STATUSES})`);
    } else if (view !== 'all') {
      query = query.or(`payment_status.eq.paid,status.in.(${SETTLED_STATUSES})`);
    }

    // Filter out archived orders from the main list
    query = query.or('archived.is.null,archived.eq.false');

    // Never show demo seed orders
    query = query.not('order_number', 'like', 'DEMO-COURSE-%');

    // Prefer to show product orders only when order_kind exists
    if (hasOrderKind) {
      query = query.or('order_kind.eq.product,order_kind.is.null');
    }

    // NOTE: Removed strict fulfillment_type requirement to show all orders
    // Previously: query = query.not('fulfillment_type', 'is', null);

    if (status) query = query.eq("status", status);
    if (fulfillment) query = query.eq("fulfillment_method", fulfillment);
    if (search) {
      query = query.or([
        `m_payment_id.ilike.%${search}%`,
        `merchant_payment_id.ilike.%${search}%`,
        `order_number.ilike.%${search}%`,
        `id.eq.${search}`,
        `buyer_email.ilike.%${search}%`,
        `buyer_name.ilike.%${search}%`,
        `contact_phone.ilike.%${search}%`
      ].join(","));
    }

    const { data: rows, error, count } = await query;
    if (error) throw error;

    // item counts and workshop detection
    const ids = rows.map(r => r.id);
    let byOrder: Record<string, number> = {};
    let workshopOrders: Set<string> = new Set();
    if (ids.length) {
      const { data: items, error: iErr } = await s.from("order_items")
        .select("order_id, quantity, name, sku")
        .in("order_id", ids);
      if (iErr) throw iErr;
      for (const it of items || []) {
        byOrder[it.order_id] = (byOrder[it.order_id] || 0) + (it.quantity || 0);
        // Detect workshop/course orders
        const nameLower = (it.name || '').toLowerCase();
        const skuLower = (it.sku || '').toLowerCase();
        if (nameLower.includes('workshop') || nameLower.includes('course') ||
            skuLower.includes('workshop') || skuLower.includes('course')) {
          workshopOrders.add(it.order_id);
        }
      }
    }

    const data = rows.map(r => ({
      ...r,
      item_count: byOrder[r.id] || 0,
      is_workshop: workshopOrders.has(r.id),
      short_code: r.order_number || "BL-" + (r.m_payment_id || "").replace(/[^A-Za-z0-9]/g,"").slice(-8).toUpperCase(),
      // Normalize field names (use buyer_* or fallback to customer_*)
      buyer_name: r.buyer_name || r.customer_name,
      buyer_email: r.buyer_email || r.customer_email,
      contact_phone: r.contact_phone || r.customer_phone,
      // Invoice status information
      has_invoice: !!r.invoice_url,
      invoice_ready: !!r.invoice_url
    }));

    // Calculate invoice summary
    const hasInvoices = rows.filter(r => !!r.invoice_url).length;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        ok: true, 
        total: count || 0, 
        data,
        count: count || 0,
        has_invoices: hasInvoices
      })
    };
  } catch (err:any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};
