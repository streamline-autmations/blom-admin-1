
import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "../components/data/api"; // Updated path for api
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Search, Infinity as InfinityIcon, Hammer, Archive, Check } from "lucide-react";
import { moneyZAR, dateShort } from "../components/formatUtils";
import { useToast } from "../components/ui/ToastProvider";
import { useActiveSpecials } from "../components/hooks/useActiveSpecials";
import { discountLabel } from "../components/helpers/pricing";
import { ConfirmDialog } from "../components/ui/dialog";

// Helper function to determine stock type based on category or explicit stock_type field
const getStockType = (product) => {
  // If explicit stock_type is set, use it
  if (product.stock_type) {
    return product.stock_type;
  }
  // Auto-detect based on category
  const category = (product.category || '').toLowerCase();
  if (category.includes('course') || category.includes('workshop') || category.includes('training')) {
    return 'unlimited';
  }
  if (category.includes('furniture')) {
    return 'made_on_demand';
  }
  return 'tracked';
};

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, product: null });
  const [selectedIds, setSelectedIds] = useState([]);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const allProducts = await api.listProducts();
      // Filter out variants - only show main products
      const mainProducts = allProducts.filter(p => 
        !p.is_variant && 
        p.is_variant !== true &&
        !p.variant_name && // Also exclude products with variant names
        p.status !== 'deleted' && // Exclude soft-deleted products
        !p.name?.startsWith('[DELETED]') // Exclude products marked as deleted via fallback
      );
      console.log(`📊 Filtered ${allProducts.length} products to ${mainProducts.length} main products (excluded variants)`);
      return mainProducts;
    },
    refetchOnWindowFocus: true, // Auto-refetch when page is focused
    refetchInterval: false, // Don't poll constantly
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  const { getDisplayPriceCents } = useActiveSpecials();

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // Permanently delete product from database (or archive if it has orders)
      // Use Netlify function to bypass client write restrictions
      const response = await fetch('/.netlify/functions/delete-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, forceDelete: true })
      });

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error || 'Failed to delete product');
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (result.softDeleted) {
         showToast('success', 'Product removed from view (soft deleted due to existing orders)');
      } else if (result.archived) {
        showToast('info', result.message || 'Product could not be permanently deleted and was archived instead (has existing orders)');
      } else if (result.deleted) {
        showToast('success', 'Product permanently deleted successfully');
      } else {
        showToast('success', 'Product deleted successfully');
      }
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to delete product');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      // Bulk delete products
      const results = await Promise.all(
        ids.map(id =>
          fetch('/.netlify/functions/delete-product', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, forceDelete: true })
          }).then(res => res.json())
        )
      );
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      const archivedCount = results.filter(r => r.archived).length;
      const softDeletedCount = results.filter(r => r.softDeleted).length;
      const hardDeletedCount = results.filter(r => r.deleted && !r.softDeleted).length;
      const totalDeleted = softDeletedCount + hardDeletedCount;
      
      if (archivedCount > 0 && totalDeleted > 0) {
        showToast('info', `${totalDeleted} products deleted (${softDeletedCount} soft-deleted), ${archivedCount} archived`);
      } else if (archivedCount > 0) {
        showToast('info', `${archivedCount} products archived (had existing orders)`);
      } else if (softDeletedCount > 0) {
        showToast('success', `${totalDeleted} products deleted (${softDeletedCount} removed from view due to dependencies)`);
      } else {
        showToast('success', `${totalDeleted} products deleted successfully`);
      }
      
      setSelectedIds([]);
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to delete products');
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids) => {
      // Bulk archive products
      if (!api) throw new Error('API not available');
      
      const results = await Promise.all(
        ids.map(id =>
          api.partialUpdateProduct({ id, status: 'archived' })
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('success', `${selectedIds.length} products archived successfully`);
      setSelectedIds([]);
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to archive products');
    },
  });

  const bulkActivateMutation = useMutation({
    mutationFn: async (ids) => {
      // Bulk activate products
      if (!api) throw new Error('API not available');
      
      const results = await Promise.all(
        ids.map(id =>
          api.partialUpdateProduct({ id, status: 'active' })
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('success', `${selectedIds.length} products activated successfully`);
      setSelectedIds([]);
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to activate products');
    },
  });

  const handleDelete = (id, name) => {
    setConfirmDialog({
      isOpen: true,
      product: { id, name }
    });
  };

  const confirmDelete = () => {
    if (confirmDialog.product) {
      deleteMutation.mutate(confirmDialog.product.id);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkAction = (action) => {
  if (selectedIds.length === 0) {
    showToast('error', 'No products selected');
    return;
  }
   
  if (action === 'archive') {
    setConfirmDialog({
      isOpen: true,
      product: {
        id: 'bulk',
        name: `${selectedIds.length} products`,
        action: 'archive'
      }
    });
  } else if (action === 'delete') {
    setConfirmDialog({
      isOpen: true,
      product: {
        id: 'bulk',
        name: `${selectedIds.length} products`,
        action: 'delete'
      }
    });
  } else if (action === 'activate') {
    setConfirmDialog({
      isOpen: true,
      product: {
        id: 'bulk',
        name: `${selectedIds.length} products`,
        action: 'activate'
      }
    });
  }
  };

  const confirmBulkAction = () => {
  if (confirmDialog.product?.action === 'archive') {
    bulkArchiveMutation.mutate(selectedIds);
  } else if (confirmDialog.product?.action === 'delete') {
    bulkDeleteMutation.mutate(selectedIds);
  } else if (confirmDialog.product?.action === 'activate') {
    bulkActivateMutation.mutate(selectedIds);
  }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Default "all" view should HIDE archived/trash items unless searched for
    if (statusFilter === 'all') {
      const isArchived = p.status === 'archived' || p.name?.toLowerCase().includes('z_trash');
      // Show archived only if searching, otherwise hide them
      if (isArchived && !searchTerm) return false;
      return matchesSearch;
    }
    
    // Strict status filtering
    const matchesStatus = p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    // When viewing all status, prioritize active products over archived ones
    if (statusFilter === 'all') {
      // Define priority order: active > draft > archived
      const statusPriority = { 'active': 0, 'draft': 1, 'archived': 2 };
      const aPriority = statusPriority[a.status] ?? 999;
      const bPriority = statusPriority[b.status] ?? 999;
      
      // Sort by status priority first
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // If same status, sort by updated date (newest first)
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    
    // For specific status filters, just sort by updated date (newest first)
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  return (
    <>
      <style>{`
        .products-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .products-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
        }

        .header-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          width: 240px;
          max-width: 100%;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
        }

        .bulk-actions-panel {
          background: var(--card);
          border-radius: 16px;
          padding: 16px 20px;
          margin-bottom: 20px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .bulk-select-info {
          font-size: 14px;
          color: var(--text);
          font-weight: 600;
        }

        .bulk-action-buttons {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .btn-bulk-action {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn-bulk-action:hover {
          transform: translateY(-2px);
        }

        .btn-bulk-action.archive {
          background: #f59e0b20;
          color: #f59e0b;
        }

        .btn-bulk-action.delete {
          background: #ef444420;
          color: #ef4444;
        }
        
        .btn-bulk-action.activate {
          background: #10b98120;
          color: #10b981;
        }

        .checkbox-cell {
          width: 40px;
        }

        .checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .search-input:focus {
          outline: none;
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }

        .filter-select {
          padding: 12px 16px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          cursor: pointer;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
          min-width: 140px;
        }

        .btn-primary {
          padding: 12px 24px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: all 0.3s ease;
          text-decoration: none;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .products-table {
          background: var(--card);
          border-radius: 20px;
          padding: 0;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          overflow: hidden;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 20px 24px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border);
          background: var(--card);
        }

        td {
          padding: 20px 24px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
        }

        tr:last-child td {
          border-bottom: none;
        }

        tbody tr {
          transition: all 0.2s ease;
        }

        tbody tr:hover {
          background: rgba(110, 193, 255, 0.05);
        }

        .product-name {
          font-weight: 600;
        }

        .product-sku {
          font-size: 12px;
          color: var(--text-muted);
        }

        .status-badge {
          display: inline-flex;
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .status-active {
          background: #10b98120;
          color: #10b981;
        }

        .status-published {
          background: #10b98120;
          color: #10b981;
        }

        .status-draft {
          background: #f59e0b20;
          color: #f59e0b;
        }

        .status-archived {
          background: #6b728020;
          color: #6b7280;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          min-width: 44px;
          min-height: 44px;
          width: 44px;
          height: 44px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .btn-icon:hover {
          color: var(--accent);
        }

        .btn-icon:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .btn-icon-danger:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
        }

        .btn-icon-danger:active {
          background: rgba(239, 68, 68, 0.2);
          border-color: #dc2626;
        }

        /* Make delete button more prominent on mobile */
        @media (max-width: 768px) {
          .btn-icon-danger {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.05);
          }
          
          .btn-icon-danger:hover {
            background: rgba(239, 68, 68, 0.15);
          }
        }

        .price-cell {
          font-weight: 600;
        }

        .compare-price {
          color: var(--text-muted);
          text-decoration: line-through;
          font-size: 13px;
          display: block;
          margin-top: 2px;
        }

        .stock-low {
          color: #ef4444;
        }

        .stock-type-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .stock-type-unlimited {
          background: #8b5cf620;
          color: #8b5cf6;
        }

        .stock-type-made-on-demand {
          background: #f59e0b20;
          color: #f59e0b;
        }

        .empty-state {
          padding: 80px 20px;
          text-align: center;
          color: var(--text-muted);
        }

        .empty-state-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 8px;
        }

        /* Enhanced mobile responsive styles */
        @media (max-width: 768px) {
          .products-header {
            flex-direction: column;
            align-items: stretch;
            margin-bottom: 16px;
            gap: 8px;
          }

          .header-actions {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          /* Make search box shorter and more compact */
          .search-box {
            width: 100%;
            max-width: 100%;
          }

          .search-input {
            padding: 10px 14px 10px 40px;
            font-size: 16px;
          }

          .search-icon {
            left: 12px;
          }

          /* Make filter select shorter */
          .filter-select {
            flex: 1;
            font-size: 16px;
            padding: 10px 16px;
            min-height: 44px;
          }

          .btn-primary {
            flex: 1;
            justify-content: center;
            min-height: 44px;
            padding: 12px 20px;
          }

          .products-title {
            font-size: 20px;
            margin-bottom: 2px;
          }

          /* Better table container - force horizontal scrolling */
          .table-container {
            -webkit-overflow-scrolling: touch;
            overflow-x: auto;
            overflow-y: hidden;
            margin: 0 -16px;
            padding: 0 16px 8px;
            width: calc(100vw + 32px); /* Account for margins */
            position: relative;
            /* Force scrolling by exceeding viewport */
            min-width: calc(100vw + 32px);
            /* Ensure scrollable */
            scroll-snap-type: x proximity;
          }

          .products-table {
            border-radius: 12px;
            margin: 0;
            min-width: 800px; /* Much wider to force scrolling */
          }

          /* Ensure all table columns are visible and properly sized */
          table {
            min-width: 800px; /* Much wider minimum */
            width: 100%;
            border-collapse: collapse;
            /* Force table to be wider than container */
            table-layout: fixed;
          }

          th, td {
            padding: 10px 12px;
            font-size: 12px;
            white-space: nowrap;
            min-width: 80px; /* Reduce column width */
          }

          /* Give more space to important columns */
          th:first-child, td:first-child {
            min-width: 120px; /* Product name column */
          }

          th:nth-child(6), td:nth-child(6) {
            min-width: 140px; /* Actions column - ensure enough space */
            /* Make actions column sticky/fixed on right */
            position: sticky;
            right: 0;
            background: var(--card);
            z-index: 15;
            border-left: 2px solid var(--border);
          }

          th {
            padding: 12px 14px;
            font-size: 11px;
            font-weight: 700;
            background: var(--card);
            position: sticky;
            top: 0;
            z-index: 10;
          }

          /* Enhanced action buttons - make them very visible on mobile */
          .action-buttons {
            gap: 10px;
            min-width: 140px; /* Much more space for buttons */
            padding: 8px 0; /* More padding */
            display: flex;
            justify-content: flex-start;
            align-items: center;
            /* Add subtle background to make area more visible */
            background: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
            padding: 8px;
          }

          .btn-icon {
            min-width: 52px; /* Much larger on mobile */
            min-height: 52px;
            width: 52px;
            height: 52px;
            position: relative;
            z-index: 1; /* Ensure buttons are above other elements */
            /* Much more prominent styling */
            background: var(--card);
            border: 2px solid var(--border);
            box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
            /* Make icons larger too */
          }

          .btn-icon svg {
            width: 20px; /* Larger icons */
            height: 20px;
          }

          /* Better touch targets */
          .btn-icon,
          .btn-primary,
          .filter-select {
            touch-action: manipulation;
            -webkit-tap-highlight-color: rgba(0,0,0,0.1);
          }

          .btn-icon:active,
          .btn-primary:active {
            transform: scale(0.98);
          }

          /* Very prominent scroll indicators */
          .table-container::before {
            content: '';
            position: sticky;
            left: 0;
            top: 0;
            bottom: 0;
            width: 30px;
            background: linear-gradient(90deg, var(--card) 0%, transparent 100%);
            pointer-events: none;
            z-index: 5;
          }

          .table-container::after {
            content: '→ SCROLL RIGHT FOR ACTIONS ←';
            display: block;
            text-align: center;
            font-size: 14px;
            color: var(--accent);
            padding: 12px 0;
            opacity: 1;
            font-weight: 700;
            /* Strong pulse animation to demand attention */
            animation: pulseHint 1.5s infinite;
            border: 2px dashed var(--accent);
            border-radius: 8px;
            margin: 8px 16px;
            background: rgba(59, 130, 246, 0.1);
          }

          @keyframes pulseHint {
            0% { 
              opacity: 0.6; 
              transform: scale(0.98);
              background: rgba(59, 130, 246, 0.1);
            }
            50% { 
              opacity: 1; 
              transform: scale(1.02);
              background: rgba(59, 130, 246, 0.2);
            }
            100% { 
              opacity: 0.6; 
              transform: scale(0.98);
              background: rgba(59, 130, 246, 0.1);
            }
          }

          /* Keep all columns visible - no hiding */
          th:nth-child(n),
          td:nth-child(n) {
            display: table-cell;
          }

          /* Enhanced scrolling performance */
          .table-container {
            scroll-behavior: smooth;
          }

          /* Table row hover effects */
          tbody tr:hover {
            background: rgba(110, 193, 255, 0.05);
          }
        }

        @media (max-width: 480px) {
          .products-header {
            margin-bottom: 12px;
          }

          .header-actions {
            gap: 6px;
          }

          /* Even shorter search and filter bars */
          .search-input {
            font-size: 16px;
            padding: 8px 12px 8px 36px;
          }

          .filter-select {
            font-size: 16px;
            padding: 8px 12px;
            min-height: 40px;
          }

          .btn-primary {
            min-height: 40px;
            padding: 10px 16px;
          }

          th,
          td {
            padding: 8px 10px;
            font-size: 11px;
            min-width: 90px; /* Further reduce for very small screens */
          }

          th {
            padding: 10px 12px;
            font-size: 10px;
          }

          .products-title {
            font-size: 18px;
          }

          /* Ensure action buttons remain very visible on very small screens */
          .btn-icon {
            min-width: 48px; /* Still larger than before */
            min-height: 48px;
            width: 48px;
            height: 48px;
            border: 2px solid var(--border);
          }

          .btn-icon svg {
            width: 18px; /* Still larger icons */
            height: 18px;
          }

          /* Ensure action buttons column has enough space */
          .action-buttons {
            min-width: 110px; /* Keep adequate space for larger buttons */
            gap: 8px;
            padding: 6px 0;
          }

          /* Force table scrolling on very small screens */
          .table-container {
            margin: 0 -12px;
            padding: 0 12px 6px;
            width: calc(100vw + 24px); /* Force wider than viewport */
            min-width: calc(100vw + 24px);
          }

          table {
            min-width: 750px; /* Force much wider table */
            table-layout: fixed;
          }

          .products-table {
            min-width: 750px; /* Force wider */
          }
        }

        /* Enhanced scrolling styles */
        .table-container::-webkit-scrollbar {
          height: 4px;
        }

        .table-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .table-container::-webkit-scrollbar-thumb {
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

          /* Better empty state for mobile */
          .empty-state {
            padding: 40px 16px;
          }

          .empty-state-title {
            font-size: 18px;
          }
        }
      `}</style>

      <div className="products-header">
        <h1 className="products-title">Products</h1>
        <div className="header-actions">
          <div className="search-box">
            <Search className="search-icon w-5 h-5" />
            <input
              type="text"
              className="search-input"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active (Only)</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <Link to={createPageUrl("ProductNew")} className="btn-primary">
            <Plus className="w-5 h-5" />
            New Product
          </Link>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-actions-panel">
          <div className="bulk-select-info">
            {selectedIds.length} of {filteredProducts.length} products selected
          </div>
          <div className="bulk-action-buttons">
            <button
              className="btn-bulk-action activate"
              onClick={() => handleBulkAction('activate')}
              disabled={bulkActivateMutation.isPending}
            >
              <Check className="w-4 h-4" />
              Activate Selected
            </button>
            <button
              className="btn-bulk-action archive"
              onClick={() => handleBulkAction('archive')}
              disabled={bulkArchiveMutation.isPending}
            >
              <Archive className="w-4 h-4" />
              Archive Selected
            </button>
            <button
              className="btn-bulk-action delete"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <div className="products-table">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Product</th>
                <th>Status</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="empty-state">Loading products...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-state-title">No products found</div>
                    <div>{searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first product to get started'}</div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const stockType = getStockType(product);
                  const displayPriceCents = getDisplayPriceCents('product', product.id, product.price_cents);
                  const discount = discountLabel(product.price_cents, displayPriceCents);
                  
                  return (
                    <tr key={product.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                        />
                      </td>
                      <td>
                        <div className="product-name">{product.name}</div>
                        {product.sku && <div className="product-sku">SKU: {product.sku}</div>}
                      </td>
                      <td>
                        <span className={`status-badge status-${product.status}`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="price-cell">
                        {moneyZAR(displayPriceCents)}
                        {(discount || product.compare_at_price_cents) && (
                          <span className="compare-price">
                            {moneyZAR(product.compare_at_price_cents || product.price_cents)}
                          </span>
                        )}
                        {discount && (
                          <div className="text-xs text-green-600 font-medium">
                            {discount.pct}% OFF
                          </div>
                        )}
                      </td>
                      <td>
                        {stockType === 'unlimited' ? (
                          <span className="stock-type-badge stock-type-unlimited">
                            <InfinityIcon size={12} />
                            Unlimited
                          </span>
                        ) : stockType === 'made_on_demand' ? (
                          <span className="stock-type-badge stock-type-made-on-demand">
                            <Hammer size={12} />
                            On Demand
                          </span>
                        ) : (
                          <span className={product.stock_qty < 5 ? 'stock-low' : ''}>
                            {product.stock_qty}
                            {product.stock_qty < 5 && ' (Low)'}
                          </span>
                        )}
                      </td>
                      <td>{dateShort(product.updated_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <Link to={`/products/${product.id}`}>
                            <button
                              className="btn-icon"
                              onClick={() => console.log('Navigating to edit:', product.id)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </Link>
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleDelete(product.id, product.name)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, product: null })}
        onConfirm={confirmDialog.product?.action ? confirmBulkAction : confirmDelete}
        title={confirmDialog.product?.action === 'archive' ? 'Archive Products' : confirmDialog.product?.action === 'delete' ? 'Delete Products' : confirmDialog.product?.action === 'activate' ? 'Activate Products' : 'Delete Product'}
        description={confirmDialog.product?.action === 'archive'
          ? `Archive ${confirmDialog.product?.name}? This will move them to archived status but keep them in the database.`
          : confirmDialog.product?.action === 'delete'
            ? `Permanently delete ${confirmDialog.product?.name}? This action cannot be undone and will remove these products from Supabase completely.`
            : confirmDialog.product?.action === 'activate'
              ? `Activate ${confirmDialog.product?.name}? This will set their status to active and make them available for sale.`
              : `Permanently delete "${confirmDialog.product?.name}"? This action cannot be undone and will remove the product from Supabase completely.`}
        confirmText={confirmDialog.product?.action === 'archive' ? 'Archive' : confirmDialog.product?.action === 'delete' ? 'Delete' : confirmDialog.product?.action === 'activate' ? 'Activate' : 'Delete'}
        cancelText="Cancel"
      />
    </>
  );
}
