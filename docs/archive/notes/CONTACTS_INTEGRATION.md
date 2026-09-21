# Contacts Integration Guide

This document explains how to integrate contact collection from your frontend with the admin panel's Contacts page.

## Overview

The contacts system stores customer information for promotional purposes from:
- **Blom Beauty Club sign-ups** - Newsletter/loyalty program members
- **Account creations** - Registered customer accounts
- **Orders** - Customers who have placed orders
- **Manual entry** - Contacts added manually through the admin panel

## Setup Steps

### 1. Run the Database Migration

Execute the SQL migration in your Supabase dashboard:

```bash
# Location: db/migrations/setup_contacts.sql
```

Go to Supabase Dashboard → SQL Editor → paste the contents of `setup_contacts.sql` and run it.

This creates:
- `contacts` table with fields: id, name, email, phone, source, subscribed, notes, created_at, updated_at
- Unique constraint on email (prevents duplicates)
- RLS policies for secure access
- `upsert_contact()` function that handles duplicates gracefully

### 2. Frontend Integration

#### For Blom Beauty Club Sign-ups

Add this to your newsletter/club sign-up form submission:

```javascript
async function handleBeautyClubSignup(formData) {
  const response = await fetch('/.netlify/functions/contacts-intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: formData.name,           // optional
      email: formData.email,         // required
      phone: formData.phone,         // optional
      source: 'beauty_club_signup'   // identifies as club signup
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json(); // { ok: true, id: "uuid" }
}
```

#### For Account Creations

Add this when a user creates an account:

```javascript
async function handleAccountCreation(userData) {
  // ... your existing account creation logic ...

  // Save contact info for promotional purposes
  await fetch('/.netlify/functions/contacts-intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: userData.fullName,
      email: userData.email,
      phone: userData.phone,
      source: 'account_creation'
    })
  });
}
```

#### For Order Completions

Capture contact info when orders are placed:

```javascript
async function handleOrderCompletion(orderData) {
  // ... your existing order processing ...

  // Save customer contact for future promotions
  await fetch('/.netlify/functions/contacts-intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: orderData.customerName,
      email: orderData.customerEmail,
      phone: orderData.customerPhone,
      source: 'order'
    })
  });
}
```

## API Reference

### POST /.netlify/functions/contacts-intake

Public endpoint for frontend integration.

**Request Body:**
```json
{
  "name": "John Doe",           // optional - customer name
  "email": "john@example.com",  // required - customer email
  "phone": "+27123456789",      // optional - customer phone
  "source": "beauty_club_signup", // required - one of: beauty_club_signup, account_creation, order
  "notes": "Additional info"    // optional - any notes
}
```

**Response (Success):**
```json
{
  "ok": true,
  "id": "uuid-of-contact"
}
```

**Response (Error):**
- 400: Invalid email or missing required fields
- 500: Database error

### GET /.netlify/functions/contacts-list

Admin endpoint to fetch contacts.

**Query Parameters:**
- `source` - Filter by source (beauty_club_signup, account_creation, order, manual)
- `subscribed` - Filter by subscription status (true/false)

**Example:**
```
/.netlify/functions/contacts-list?source=beauty_club_signup&subscribed=true
```

### POST /.netlify/functions/contacts-add

Admin endpoint for manual contact entry.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+27987654321",
  "source": "manual",
  "notes": "VIP customer"
}
```

## Features in Admin Panel

The Contacts page (`/contacts`) includes:

1. **View all contacts** - See name, email, phone, source, and date added
2. **Filter by source** - Show only Beauty Club sign-ups, Account creations, Orders, or Manual entries
3. **Export to CSV** - Download contacts for use in email marketing tools
4. **Add contacts manually** - Add contacts directly through the admin panel
5. **Contact count** - See total number of contacts

## Handling Duplicates

The system automatically handles duplicate emails:
- If a contact with the same email already exists, it updates the record
- Name and phone are updated if the new values are provided
- Notes are appended (not replaced)
- The `updated_at` timestamp is refreshed
- Source remains from the original entry (first touchpoint)

## Privacy & Compliance

- Store a `subscribed` boolean to track opt-in/opt-out status
- Respect unsubscribe requests by updating `subscribed = false`
- Export feature helps with data portability requests
- Consider adding consent checkboxes to your frontend forms

## Example: Complete Beauty Club Sign-up Form

```jsx
function BeautyClubSignup() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch('/.netlify/functions/contacts-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          source: 'beauty_club_signup'
        })
      });

      if (!res.ok) throw new Error(await res.text());

      setStatus('success');
      setFormData({ name: '', email: '', phone: '' });
    } catch (err) {
      setStatus('error');
      console.error('Signup failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your Name"
        value={formData.name}
        onChange={e => setFormData({...formData, name: e.target.value})}
      />
      <input
        type="email"
        placeholder="Email (required)"
        value={formData.email}
        onChange={e => setFormData({...formData, email: e.target.value})}
        required
      />
      <input
        type="tel"
        placeholder="Phone Number"
        value={formData.phone}
        onChange={e => setFormData({...formData, phone: e.target.value})}
      />
      <button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Joining...' : 'Join Beauty Club'}
      </button>
      {status === 'success' && <p>Welcome to the Blom Beauty Club!</p>}
      {status === 'error' && <p>Something went wrong. Please try again.</p>}
    </form>
  );
}
```

## Next Steps

1. Run the database migration in Supabase
2. Add the sign-up forms to your frontend
3. Test by adding a contact manually in the admin panel
4. Integrate the API calls into your existing forms
5. Export contacts and import into your email marketing platform
