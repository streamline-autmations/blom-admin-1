import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, RefreshCw, Truck, Package, Archive, Filter, X, FileText, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ConfirmDialog } from '../components/ui/dialog';
import { useNotifications } from '../contexts/NotificationContext';

export default function Orders() {
  const navigate = useNavigate();
  const { markAsRead } = useNotifications();

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    fulfillmentType: '',
    status: '',
    search: '',
    view: 'paid'
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: ordersResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', currentPage, filters.status, filters.search, filters.fulfillmentType, filters.view],
    queryFn: async () => {
      const params = new URLSearchParams({ page: currentPage, size: PAGE_SIZE });
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      if (filters.fulfillmentType) params.set('fulfillment', filters.fulfillmentType);
      if (filters.view && filters.view !== 'paid') params.set('view', filters.view);
      const res = await fetch(`/.netlify/functions/admin-orders?${params}`);
      if (!res.ok) throw new Error('Failed to fetch orders');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load orders');
      return json;
    },
    staleTime: 0,
    cacheTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, order: null });

  const [backfill, setBackfill] = useState({
    payment_id: '',
    amount: '',
    buyer_email: '',
    buyer_name: ''
  });
  const [backfilling, setBackfilling] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);
  const [invoiceToolsEnabled, setInvoiceToolsEnabled] = useState(() => localStorage.getItem('blom_invoice_tools') === '1');

  const orders = ordersResponse?.data || [];
  const totalCount = ordersResponse?.count || 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('tools');
    if (v === '1') {
      localStorage.setItem('blom_invoice_tools', '1');
      setInvoiceToolsEnabled(true);
    }
    if (v === '0') {
      localStorage.removeItem('blom_invoice_tools');
      setInvoiceToolsEnabled(false);
    }
  }, []);

  const regenerateInvoice = async (order) => {
    const m_payment_id = order?.m_payment_id || order?.merchant_payment_id;
    if (!order?.id || !m_payment_id) {
      alert('Missing order id or payment reference');
      return;
    }

    const confirmed = window.confirm('Regenerate invoice? This will overwrite the existing invoice link.');
    if (!confirmed) return;

    setRegeneratingId(order.id);
    try {
      const res = await fetch('/.netlify/functions/invoice-pdf?return_url=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, m_payment_id, return_url: true })
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(detail || `Invoice regeneration failed (${res.status})`);
      }

      await refetch();
      alert('Invoice regenerated. Open it again to see the updated PDF.');
    } catch (err) {
      alert(err?.message || 'Invoice regeneration failed');
    } finally {
      setRegeneratingId(null);
    }
  };

  const runBackfill = async () => {
    if (!backfill.payment_id?.trim()) {
      alert('Please enter the Payment ID / Reference');
      return;
    }
    if (!backfill.amount?.trim()) {
      alert('Please enter the amount (e.g. 2420.00)');
      return;
    }

    setBackfilling(true);
    try {
      const res = await fetch('/.netlify/functions/admin-backfill-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_id: backfill.payment_id,
          amount: backfill.amount,
          buyer_email: backfill.buyer_email,
          buyer_name: backfill.buyer_name,
          provider: 'manual'
        })
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Backfill failed');
      }

      await refetch();
      setBackfill({ payment_id: '', amount: '', buyer_email: '', buyer_name: '' });

      if (json.order_id) {
        navigate(`/orders/${json.order_id}`);
      }
    } catch (err) {
      alert(err?.message || 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  };

  // Listen for order updates from other pages
  useEffect(() => {
    const handleOrderUpdate = (event) => {
      console.log('🔄 Order update detected, refetching orders...');
      refetch();
    };

    window.addEventListener('orderStatusUpdated', handleOrderUpdate);
    
    return () => {
      window.removeEventListener('orderStatusUpdated', handleOrderUpdate);
    };
  }, [refetch]);

  // Filter orders based on current filters
  const filteredOrders = orders.filter(order => {
    // Date filter
    if (filters.dateFrom) {
      const orderDate = new Date(order.placed_at || order.created_at);
      const fromDate = new Date(filters.dateFrom);
      if (orderDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const orderDate = new Date(order.placed_at || order.created_at);
      const toDate = new Date(filters.dateTo);
      if (orderDate > toDate) return false;
    }

    // Fulfillment type filter
    if (filters.fulfillmentType && order.fulfillment_type !== filters.fulfillmentType) {
      return false;
    }

    // Status filter
    if (filters.status && order.status !== filters.status) {
      return false;
    }

    // Search filter (customer name or email or order code)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const customerName = (order.buyer_name || order.customer_name || '').toLowerCase();
      const customerEmail = (order.buyer_email || order.customer_email || '').toLowerCase();
      const orderCode = (order.short_code || order.order_number || order.merchant_payment_id || order.m_payment_id || order.id || '').toLowerCase();
      
      if (!customerName.includes(searchLower) && 
          !customerEmail.includes(searchLower) && 
          !orderCode.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  // Archive order function
  const handleArchiveOrder = (orderId) => {
    setConfirmDialog({
      isOpen: true,
      order: { id: orderId }
    });
  };

  const confirmArchiveOrder = async () => {
    if (!confirmDialog.order) return;

    try {
      const response = await fetch('/.netlify/functions/admin-order', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: confirmDialog.order.id,
          archived: true
        }),
      });

      if (!response.ok) throw new Error('Failed to archive order');

      // Refetch orders to update the list
      refetch();
    } catch (error) {
      console.error('Error archiving order:', error);
      alert('Failed to archive order. Please try again.');
    }
  };

  // Reset page when server-side filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.status, filters.search, filters.fulfillmentType, filters.view]);

  // Clear filters
  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      fulfillmentType: '',
      status: '',
      search: '',
      view: 'paid'
    });
  };

  // Server-side pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  // Get unique statuses and fulfillment types for filter options
  const uniqueStatuses = [...new Set(orders.map(order => order.status).filter(Boolean))];
  const uniqueFulfillmentTypes = [...new Set(orders.map(order => order.fulfillment_type).filter(Boolean))];

  return (
    <>
      <style>{`
        .orders-header {
          margin-bottom: 32px;
        }

        .header-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .header-subtitle {
          color: var(--text-muted);
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .btn-secondary {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-secondary:hover {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .section-card {
          background: var(--card);
          border-radius: 16px;
          padding: 0;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 16px 24px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--card);
          border-bottom: 1px solid var(--border);
        }

        td {
          padding: 16px 24px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
        }

        tr:last-child td {
          border-bottom: none;
        }

        tbody tr:hover {
          background: rgba(110, 193, 255, 0.05);
        }

        .fulfillment-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .fulfillment-delivery {
          background: #3b82f620;
          color: #3b82f6;
        }

        .fulfillment-collection {
          background: #8b5cf620;
          color: #8b5cf6;
        }

        .status-badge {
          display: inline-flex;
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .status-paid {
          background: #16a34a20;
          color: #16a34a;
        }

        .status-packed {
          background: #dc262620;
          color: #dc2626;
        }

        .status-delivered, .status-collected {
          background: #05966920;
          color: #059669;
        }

        .status-out_for_delivery {
          background: #ea580c20;
          color: #ea580c;
        }

        .status-unpaid, .status-created {
          background: #eab30820;
          color: #ca8a04;
        }

        .status-cancelled {
          background: #991b1b20;
          color: #991b1b;
        }

        .btn-view {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
        }

        .btn-view:hover {
          transform: translateY(-1px);
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .btn-archive {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
          margin-left: 8px;
        }

        .btn-archive:hover {
          transform: translateY(-1px);
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .btn-invoice {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
        }

        .btn-invoice:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .btn-invoice:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .filters-section {
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          display: none;
        }

        .filters-section.show {
          display: block;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          align-items: end;
        }

        /* Enhanced mobile responsive styles */
        @media (max-width: 768px) {
          .orders-header {
            margin-bottom: 20px;
          }

          .header-title {
            font-size: 24px;
            margin-bottom: 6px;
          }

          .header-subtitle {
            font-size: 13px;
          }

          .header-actions {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            margin-bottom: 20px;
          }

          .header-actions > div:first-child {
            flex-direction: column;
            gap: 8px;
            width: 100%;
          }

          .header-actions > div:first-child > button {
            width: 100%;
            justify-content: center;
            min-height: 44px;
          }

          .header-actions > div:last-child {
            width: 100%;
          }

          .header-actions > div:last-child > button {
            width: 100%;
            justify-content: center;
            min-height: 44px;
          }

          /* Enhanced filters section */
          .filters-section {
            margin-bottom: 20px;
            border-radius: 12px;
            padding: 16px;
          }

          .filters-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .filter-group {
            width: 100%;
          }

          .filter-label {
            font-size: 11px;
            margin-bottom: 6px;
          }

          .filter-input,
          .filter-select {
            width: 100%;
            font-size: 16px; /* Prevent iOS zoom */
            padding: 12px 14px;
            min-height: 44px;
          }

          .filter-actions {
            flex-direction: column;
            gap: 10px;
            margin-top: 16px;
          }

          .filter-actions button {
            width: 100%;
            min-height: 44px;
            font-size: 16px;
          }

          .btn-filter-primary,
          .btn-filter-secondary {
            padding: 12px 20px;
          }

          .results-count {
            font-size: 13px;
            text-align: center;
            margin-bottom: 0;
          }

          /* Enhanced table styles for mobile */
          .section-card {
            border-radius: 12px;
            margin: 0 -16px;
          }

          th {
            padding: 12px 8px;
            font-size: 10px;
          }

          td {
            padding: 12px 8px;
            font-size: 13px;
          }

          /* Stack customer info on mobile */
          td:nth-child(3) {
            max-width: 120px;
            overflow: hidden;
          }

          td:nth-child(3) div:first-child {
            font-size: 12px;
            font-weight: 600;
          }

          td:nth-child(3) div:nth-child(2) {
            font-size: 11px;
            color: var(--text-muted);
          }

          td:nth-child(3) div:nth-child(3) {
            display: none; /* Hide address on mobile */
          }

          /* Smaller fulfillment and status badges */
          .fulfillment-badge,
          .status-badge {
            padding: 3px 8px;
            font-size: 10px;
            font-weight: 600;
          }

          .fulfillment-badge svg,
          .status-badge svg {
            display: none; /* Hide icons on small screens */
          }

          /* Enhanced action buttons for mobile */
          .btn-view {
            padding: 8px 12px;
            font-size: 12px;
            margin-left: 0;
            margin-bottom: 4px;
          }

          .btn-archive {
            padding: 8px 12px;
            font-size: 12px;
            margin-left: 4px;
          }

          /* Stack action buttons vertically on small screens */
          td:last-child > div {
            flex-direction: column;
            align-items: stretch;
            gap: 4px;
          }

          /* Better touch targets */
          .btn-secondary,
          .btn-view,
          .btn-archive,
          .btn-filter-primary,
          .btn-filter-secondary {
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(0,0,0,0.1);
          }

          .btn-secondary:active,
          .btn-view:active,
          .btn-archive:active,
          .btn-filter-primary:active,
          .btn-filter-secondary:active {
            transform: scale(0.98);
          }

          /* Table scroll indicators */
          .section-card > div:last-child::after {
            content: '← Swipe to see more →';
            display: block;
            text-align: center;
            font-size: 11px;
            color: var(--text-muted);
            padding: 8px;
            opacity: 0.7;
          }

          /* Ensure table scrolls horizontally */
          .section-card > div:last-child {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 0 -16px;
            padding: 0 16px;
          }

          table {
            min-width: 700px; /* Ensure enough width for content */
          }

          /* Hide less important columns on mobile */
          th:nth-child(6), /* Items count */
          td:nth-child(6) {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .orders-header {
            margin-bottom: 16px;
          }

          .header-title {
            font-size: 22px;
          }

          .header-subtitle {
            font-size: 12px;
          }

          .filters-section {
            padding: 14px;
          }

          .filter-input,
          .filter-select {
            padding: 10px 12px;
            font-size: 16px;
          }

          /* Hide even more columns on very small screens */
          th:nth-child(2), /* Date */
          td:nth-child(2),
          th:nth-child(4), /* Type */
          td:nth-child(4) {
            display: none;
          }

          th {
            padding: 10px 6px;
            font-size: 9px;
          }

          td {
            padding: 10px 6px;
            font-size: 12px;
          }

          /* Hide customer email on very small screens */
          td:nth-child(3) div:nth-child(2) {
            display: none;
          }

          table {
            min-width: 500px;
          }
        }

        /* Enhanced scrolling styles */
        .section-card > div:last-child::-webkit-scrollbar {
          height: 4px;
        }

        .section-card > div:last-child::-webkit-scrollbar-track {
          background: transparent;
        }

        .section-card > div:last-child::-webkit-scrollbar-thumb {
          background: var(--accent);
          border-radius: 2px;
        }

        /* Touch improvements for all screen sizes */
        @media (max-width: 768px) {
          tbody tr {
            touch-action: manipulation;
          }

          tbody tr:active {
            background: rgba(110, 193, 255, 0.1);
          }
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .filter-input,
        .filter-select {
          padding: 10px 14px;
          border-radius: 8px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
          outline: none;
        }

        .filter-input:focus,
        .filter-select:focus {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light), 0 0 0 2px var(--accent);
        }

        .filter-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .btn-filter-primary {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
        }

        .btn-filter-secondary {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .results-count {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 24px;
          padding: 8px 0;
        }

        .pagination-btn {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .pagination-btn:hover:not(:disabled) {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-info {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 600;
          min-width: 120px;
          text-align: center;
        }

        @media (max-width: 480px) {
          .pagination {
            gap: 8px;
          }
          .pagination-btn {
            padding: 10px 14px;
            font-size: 13px;
          }
          .pagination-info {
            font-size: 13px;
            min-width: 90px;
          }
        }
      `}</style>

      <div className="orders-header">
        <h1 className="header-title">Orders</h1>
        <p className="header-subtitle">Manage customer orders and fulfillment</p>
      </div>

      <div className="header-actions">
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className="btn-secondary"
            style={{ 
              background: showFilters ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'var(--card)',
              color: showFilters ? 'white' : 'var(--text)'
            }}
          >
            <Filter size={16} /> Filters
          </button>
          {(filters.dateFrom || filters.dateTo || filters.fulfillmentType || filters.status || filters.search || filters.view !== 'paid') && (
            <button onClick={clearFilters} className="btn-secondary">
              <X size={16} /> Clear Filters
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => markAsRead('orders')} className="btn-secondary">
            <CheckCircle size={16} /> Mark read
          </button>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw size={16} /> Reload
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className={`filters-section ${showFilters ? 'show' : ''}`}>
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">Search</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Search orders, customers..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                if (filters.search.trim() === '/tools') {
                  const next = !invoiceToolsEnabled;
                  if (next) localStorage.setItem('blom_invoice_tools', '1');
                  else localStorage.removeItem('blom_invoice_tools');
                  setInvoiceToolsEnabled(next);
                  setFilters({ ...filters, search: '' });
                  e.preventDefault();
                }
              }}
            />
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Date From</label>
            <input
              type="date"
              className="filter-input"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
            />
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Date To</label>
            <input
              type="date"
              className="filter-input"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
            />
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Fulfillment Type</label>
            <select
              className="filter-select"
              value={filters.fulfillmentType}
              onChange={(e) => setFilters({...filters, fulfillmentType: e.target.value})}
            >
              <option value="">All Types</option>
              {uniqueFulfillmentTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'collection' ? 'Collection' : 
                   type === 'delivery' ? 'Delivery' : 
                   type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">Payment</label>
            <select
              className="filter-select"
              value={filters.view}
              onChange={(e) => setFilters({...filters, view: e.target.value})}
            >
              <option value="paid">Paid only (default)</option>
              <option value="unpaid">Unpaid / needs attention</option>
              <option value="all">All orders</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              className="filter-select"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>
                  {status?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group" style={{ gridColumn: '1 / -1' }}>
            <label className="filter-label">Missing order? Backfill from Payment ID</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 2fr auto', gap: '12px', alignItems: 'end' }}>
              <input
                type="text"
                className="filter-input"
                placeholder="Payment ID / Reference (e.g. BL-MLHUIZ46-754416)"
                value={backfill.payment_id}
                onChange={(e) => setBackfill({ ...backfill, payment_id: e.target.value })}
              />
              <input
                type="text"
                className="filter-input"
                placeholder="Amount (e.g. 2420.00)"
                value={backfill.amount}
                onChange={(e) => setBackfill({ ...backfill, amount: e.target.value })}
              />
              <input
                type="text"
                className="filter-input"
                placeholder="Customer email (optional)"
                value={backfill.buyer_email}
                onChange={(e) => setBackfill({ ...backfill, buyer_email: e.target.value })}
              />
              <input
                type="text"
                className="filter-input"
                placeholder="Customer name (optional)"
                value={backfill.buyer_name}
                onChange={(e) => setBackfill({ ...backfill, buyer_name: e.target.value })}
              />
              <button
                type="button"
                className="btn-filter"
                onClick={runBackfill}
                disabled={backfilling}
              >
                {backfilling ? 'Adding…' : 'Add Order'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="filter-actions">
          <div className="results-count">
            Page {safePage} of {totalPages} — {totalCount} orders total
          </div>
        </div>
      </div>

      <div className="section-card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
                <th>Items</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading orders...</td></tr>
              ) : error ? (
                <tr><td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>Error: {error.message}</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {orders.length === 0 ? 'No orders found.' : 'No orders match your current filters.'}
                </td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {order.order_number || order.short_code || order.m_payment_id?.slice(0, 12)}
                    </td>
                    <td style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                      {order.placed_at
                        ? format(new Date(order.placed_at), 'MMM d, yyyy')
                        : format(new Date(order.created_at), 'MMM d, yyyy')
                      }
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.buyer_name || order.customer_name || '-'}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {order.buyer_email || order.customer_email || '-'}
                      </div>
                      {order.shipping_address && typeof order.shipping_address === 'string' && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          📍 {order.shipping_address.split('\n')[0]}
                        </div>
                      )}
                    </td>
                    <td>
                      {order.fulfillment_type === 'collection' ? (
                        <span className="fulfillment-badge fulfillment-collection">
                          <Package size={14} />
                          {String(order.collection_location || '').toLowerCase().includes('courier')
                            ? 'Courier Collection'
                            : 'Collection'}
                        </span>
                      ) : (
                        <span className="fulfillment-badge fulfillment-delivery">
                          <Truck size={14} /> Delivery
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-${order.status}`}>
                        {order.status?.replace(/_/g, ' ').toUpperCase() || 'UNKNOWN'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {order.item_count !== undefined ? order.item_count : 0}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      R{(order.total_cents / 100).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {order.invoice_url && (
                          <a
                            href={order.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-invoice"
                            title="Open invoice PDF"
                          >
                            <FileText size={14} /> Invoice
                          </a>
                        )}
                        {invoiceToolsEnabled && (
                          <button
                            type="button"
                            className="btn-invoice"
                            onClick={() => regenerateInvoice(order)}
                            disabled={regeneratingId === order.id}
                            title="Regenerate invoice"
                          >
                            <RefreshCw size={14} /> {regeneratingId === order.id ? 'Regen…' : 'Regen'}
                          </button>
                        )}
                        <button 
                          onClick={() => navigate(`/orders/${order.id}`)} 
                          className="btn-view"
                          title="View Order Details"
                        >
                          <Eye size={14} /> View
                        </button>
                        <button 
                          onClick={() => handleArchiveOrder(order.id)} 
                          className="btn-archive"
                          title="Archive Order"
                        >
                          <Archive size={14} /> Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pagination">
        <button
          className="pagination-btn"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={safePage <= 1}
        >
          ← Previous
        </button>
        <span className="pagination-info">
          Page {safePage} of {totalPages}
        </span>
        <button
          className="pagination-btn"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
        >
          Next →
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, order: null })}
        onConfirm={confirmArchiveOrder}
        title="Archive Order"
        description="Are you sure you want to archive this order? This will hide it from the main orders list."
        confirmText="Archive"
        cancelText="Cancel"
      />
    </>
  );
}
