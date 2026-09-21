# PayFast Integration Setup

## Environment Variables (Add to Netlify)

Go to Netlify → Site Settings → Environment Variables:

```bash
# PayFast Credentials
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_secure_passphrase

# PayFast Base URL
PAYFAST_BASE=https://www.payfast.co.za/eng/process
# For testing: https://sandbox.payfast.co.za/eng/process

# PayFast Return URLs (replace with your actual domain)
PAYFAST_RETURN_URL=https://your-site.com/order-success
PAYFAST_CANCEL_URL=https://your-site.com/order-cancelled
PAYFAST_NOTIFY_URL=https://your-site.com/api/payfast/itn

# Supabase (Server-side)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## API Endpoints

### 1. Create Order
**POST** `/api/orders/create`

Request body:
```json
{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+27123456789",
  "delivery_method": "shipping",
  "shipping_address": {
    "street": "123 Main St",
    "city": "Cape Town",
    "postal_code": "8001"
  },
  "items": [
    {
      "sku": "SERUM-50ML",
      "name": "Hyaluronic Acid Serum",
      "variant": "50ml",
      "qty": 2,
      "unit_price_cents": 3499
    }
  ],
  "shipping_cents": 1000,
  "discount_cents": 0,
  "tax_cents": 0,
  "currency": "ZAR"
}
```

Response:
```json
{
  "order_id": "uuid",
  "order_number": "ORD-20250129-001",
  "m_payment_id": "uuid",
  "total_cents": 7998,
  "total_zar": "79.98"
}
```

### 2. PayFast Checkout
**POST** `/api/payfast/checkout`

Request body:
```json
{
  "m_payment_id": "uuid-from-create-order",
  "amount": "79.98",
  "name_first": "John",
  "name_last": "Doe",
  "email_address": "john@example.com",
  "item_name": "BLOM Order",
  "order_id": "order-uuid"
}
```

Response:
```json
{
  "redirect": "https://www.payfast.co.za/eng/process?merchant_id=xxx&..."
}
```

Redirect the customer to this URL to complete payment.

### 3. PayFast ITN (Instant Transaction Notification)
**POST** `/api/payfast/itn`

PayFast will POST to this endpoint when payment is complete.

The function will:
- Validate signature
- Validate IP (from PayFast)
- Update order status to "paid"
- Create payment record in database
- Return 200 OK to PayFast

## Payment Flow

1. **Customer checks out** → Frontend calls `/api/orders/create`
   - Order is created in Supabase with status="unpaid"
   - Returns `m_payment_id` and `order_id`

2. **Frontend calls** `/api/payfast/checkout`
   - Receives PayFast redirect URL
   - Redirects customer to PayFast

3. **Customer pays on PayFast**
   - PayFast processes payment
   - PayFast sends ITN (webhook) to `/api/payfast/itn`

4. **ITN handler updates database**
   - Marks order as "paid"
   - Creates payment record
   - Customer is redirected to success page

5. **Customer returns** → Success page shows order confirmation

## Security Notes

- ✅ Signature validation — prevents tampering
- ✅ IP validation — only accepts requests from PayFast IPs
- ✅ Service Role Key — server-side only, never exposed to client
- ⚠️ Add proper IP validation in production (currently accepts all)

## Testing

### Sandbox Mode
1. Use sandbox credentials from PayFast
2. Set `PAYFAST_BASE=https://sandbox.payfast.co.za/eng/process`
3. Use test card: 4000 0000 0000 0002

### Production Mode
1. Get live credentials from PayFast
2. Set `PAYFAST_BASE=https://www.payfast.co.za/eng/process`
3. Set up proper return URLs (HTTPS required)

## Troubleshooting

- **ITN not received**: Check `PAYFAST_NOTIFY_URL` is publicly accessible (HTTPS)
- **Invalid signature**: Verify `PAYFAST_PASSPHRASE` matches PayFast dashboard
- **Order not updating**: Check Supabase Service Role key has write permissions
- **IP validation fails**: Add PayFast IPs to whitelist (see PayFast docs)

## Next Steps

- Add proper IP validation for production
- Add webhook retry logic
- Add order confirmation emails
- Add admin notification for new paid orders


