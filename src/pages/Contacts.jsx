import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Mail, Phone, Download, ArrowUpDown, Trash2 } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import { api } from "@/components/data/api";
import { Link } from "react-router-dom";

export default function Contacts() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [sourceFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState("");
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactsData = [], isLoading, error } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      return await api.listContacts();
    },
  });

  const contacts = useMemo(() => {
    let data = Array.isArray(contactsData.data) ? contactsData.data : (Array.isArray(contactsData) ? contactsData : []);
     
    // All contacts are now displayed (no local hiding)
    
    // Filter
    if (sourceFilter !== "all") {
      // Note: source might not be populated in all records yet, adjust as needed
      // data = data.filter(c => c.source === sourceFilter);
    }

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      data = data.filter(c =>
        (c.full_name && c.full_name.toLowerCase().includes(lower)) ||
        (c.email && c.email.toLowerCase().includes(lower)) ||
        (c.phone && c.phone.includes(lower))
      );
    }

    // Sort
    return [...data].sort((a, b) => {
      if (sortConfig.key === 'full_name') {
        const nameA = a.full_name || "";
        const nameB = b.full_name || "";
        return sortConfig.direction === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
      if (sortConfig.key === 'created_at') {
        return sortConfig.direction === 'asc'
          ? new Date(a.created_at) - new Date(b.created_at)
          : new Date(b.created_at) - new Date(a.created_at);
      }
      return 0;
    });
  }, [contactsData, sourceFilter, sortConfig, searchQuery]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/.netlify/functions/contacts-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      showToast('success', 'Contact added successfully');
      setShowAddForm(false);
      setFormData({ name: "", email: "", phone: "" });
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to add contact');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.email) {
      showToast('error', 'Email is required');
      return;
    }
    createMutation.mutate(formData);
  };

  const deleteMutation = useMutation({
    mutationFn: async (contactId) => {
      return await api.deleteContact(contactId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      showToast('success', 'Contact deleted successfully');
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to delete contact');
    },
  });

  const handleDeleteContact = (contactId, contactName) => {
    if (!confirm(`Are you sure you want to permanently delete "${contactName || 'this contact'}"? This action cannot be undone.`)) {
      return;
    }
    
    deleteMutation.mutate(contactId);
  };

  const handleExportCSV = () => {
    if (contacts.length === 0) {
      showToast('error', 'No contacts to export');
      return;
    }
    const headers = ["Name", "Email", "Phone", "Created At"];
    const rows = contacts.map(c => [
      c.full_name || "",
      c.email,
      c.phone || "",
      new Date(c.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', `Exported ${contacts.length} contacts`);
  };



  return (
    <>
      <style>{`
        .contacts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 12px;
        }

        @media (min-width: 768px) {
          .contacts-header {
            margin-bottom: 32px;
          }
        }

        .header-title {
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @media (min-width: 768px) {
          .header-title {
            font-size: 28px;
            gap: 12px;
          }
        }

        .btn-add {
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
        }

        @media (min-width: 768px) {
          .btn-add {
            padding: 12px 20px;
          }
        }

        .btn-add:hover {
          transform: translateY(-2px);
        }

        .contacts-list {
          background: var(--card);
          border-radius: 16px;
          padding: 0;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          overflow: hidden;
        }

        .table-scroll-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 500px;
        }

        th {
          text-align: left;
          padding: 16px 12px;
          font-size: 11px;
          white-space: nowrap;
        }

        @media (min-width: 768px) {
          th {
            padding: 20px 24px;
            font-size: 12px;
          }
        }

        td {
          padding: 16px 12px;
          font-size: 13px;
        }

        @media (min-width: 768px) {
          td {
            padding: 20px 24px;
            font-size: 14px;
          }
        }

        .th-mobile {
          text-align: left;
          padding: 16px 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border);
        }

        td {
          padding: 20px 24px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
        }

        tr:last-child td {
          border-bottom: none;
        }

        .contact-name {
          font-weight: 600;
        }

        .contact-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
          font-size: 13px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: var(--text-muted);
        }

        .empty-state-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 8px;
        }

        .form-modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .form-container {
          background: var(--card);
          border-radius: 16px;
          padding: 32px;
          width: 500px;
          max-width: 90vw;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }

        .form-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          border: none;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-cancel {
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .btn-submit {
          padding: 12px 24px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .filter-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
          align-items: center;
        }

        .filter-input {
          padding: 10px 16px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          min-width: 200px;
        }

        .btn-export {
          padding: 10px 16px;
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
        }

        .btn-export:hover {
          transform: translateY(-1px);
        }

        .contact-count {
          font-size: 14px;
          color: var(--text-muted);
          margin-left: auto;
        }

        .sort-header {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          user-select: none;
        }
        
        .sort-header:hover {
          color: var(--accent);
        }

        .contact-date {
          font-size: 12px;
          color: var(--text-muted);
        }
        
        .contact-row {
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .contact-row:hover {
          background-color: rgba(255,255,255,0.05);
        }

        .btn-delete {
          padding: 8px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light);
          transition: all 0.2s ease;
        }

        .btn-delete:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .btn-delete:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .delete-cell {
          text-align: right;
        }
      `}</style>

      <div className="contacts-header">
        <h1 className="header-title">
          <Users className="w-8 h-8" />
          Contacts
        </h1>
        <button className="btn-add" onClick={() => setShowAddForm(true)}>
          <Plus className="w-5 h-5" />
          Add Contact
        </button>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          className="filter-input"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn-export" onClick={handleExportCSV}>
          <Download className="w-4 h-4" />
          Export CSV
        </button>
        <div className="contact-count">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="contacts-list">
        <div className="table-scroll-wrapper">
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('full_name')}>
                  <div className="sort-header">
                    Name <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th>Email</th>
                <th>Phone</th>
                <th onClick={() => handleSort('created_at')}>
                  <div className="sort-header">
                    Signed Up <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="delete-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="empty-state">Loading...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <div className="empty-state-title">Error loading contacts</div>
                    <div>{error.message || 'Please try again'}</div>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <div className="empty-state-title">No contacts found</div>
                  </td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact.id} className="contact-row">
                    <td>
                      <Link to={`/contacts/${contact.user_id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                        <div className="contact-name">{contact.full_name || '—'}</div>
                      </Link>
                    </td>
                    <td>
                      <div className="contact-info">
                        <Mail className="w-4 h-4" />
                        {contact.email}
                      </div>
                    </td>
                    <td>
                      <div className="contact-info">
                        <Phone className="w-4 h-4" />
                        {contact.phone || '—'}
                      </div>
                    </td>
                    <td>
                      <div className="contact-date">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="delete-cell">
                      <button
                        onClick={() => handleDeleteContact(contact.id, contact.full_name)}
                        className="btn-delete"
                        title="Permanently delete contact"
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? '...' : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddForm && (
        <div className="form-modal" onClick={() => setShowAddForm(false)}>
          <div className="form-container" onClick={(e) => e.stopPropagation()}>
            <h2 className="form-title">Add New Contact</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Adding...' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
