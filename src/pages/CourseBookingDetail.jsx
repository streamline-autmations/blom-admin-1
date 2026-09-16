import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/components/data/api';

export default function CourseBookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['course-purchase', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing booking id');
      if (!api.getCoursePurchase) throw new Error('API does not support getCoursePurchase');
      return await api.getCoursePurchase(id);
    }
  });

  const booking = data || null;
  const depositOrder = booking?.deposit_order || booking?.order || null;

  const money = (cents) => {
    if (cents == null) return '-';
    const n = Number(cents);
    if (!Number.isFinite(n)) return '-';
    return `R${(n / 100).toFixed(2)}`;
  };

  const dateTime = (value) => {
    if (!value) return '-';
    try {
      return format(new Date(value), 'MMM d, yyyy HH:mm');
    } catch {
      return String(value);
    }
  };

  // Timestamp the booking was paid (deposit order's paid_at covers both
  // deposit and full payments, since the full payment is that same order).
  const paidAt = depositOrder?.paid_at || null;
  const paidAtLabel = booking?.payment_kind === 'full' ? 'Paid In Full At' : 'Deposit Paid At';

  const details = booking?.details || {};
  const owedCents =
    booking?.amount_owed_cents != null
      ? Number(booking.amount_owed_cents)
      : Number.isFinite(Number(details?.full_price_cents))
        ? Math.max(0, Number(details.full_price_cents) - Number(booking?.amount_paid_cents || 0))
        : null;

  const onDelete = async () => {
    if (!id) return;
    if (!window.confirm('Delete this course booking?')) return;
    setIsDeleting(true);
    try {
      await api.deleteCoursePurchase(id);
      navigate('/course-bookings');
    } catch (e) {
      window.alert(e?.message || 'Failed to delete course booking');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <style>{`
        .order-detail-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px;
        }

        .order-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 32px;
        }

        .btn-back {
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          transition: all 0.2s ease;
          text-decoration: none;
        }

        .btn-back:hover {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          color: var(--accent);
        }

        .order-title-section { flex: 1; }

        .order-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 8px;
        }

        .order-status-badge {
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .status-deposit { background: #eab30820; color: #ca8a04; }
        .status-full { background: #05966920; color: #059669; }

        .order-date {
          color: var(--text-muted);
          font-size: 14px;
        }

        .order-content {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 32px;
        }

        @media (max-width: 1024px) {
          .order-content { grid-template-columns: 1fr; gap: 24px; }
        }

        .section-card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .order-main-content { display: flex; flex-direction: column; gap: 24px; }
        .order-sidebar { display: flex; flex-direction: column; gap: 24px; }

        .sidebar-section-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .customer-info, .booking-info {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .info-value {
          color: var(--text);
          font-weight: 600;
        }

        .info-link {
          color: var(--accent);
          font-weight: 600;
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .info-link:hover {
          color: var(--accent-2);
          text-decoration: underline;
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
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: all 0.3s ease;
          text-decoration: none;
          justify-content: center;
          width: 100%;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-danger {
          padding: 12px 24px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: all 0.3s ease;
          width: 100%;
          justify-content: center;
        }

        .btn-danger:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

        .invoice-section {
          background: var(--bg);
          padding: 16px;
          border-radius: 12px;
          margin-top: 16px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }
      `}</style>

      <div className="order-detail-container">
        <div className="order-header">
          <Link to="/course-bookings" className="btn-back">
            <ArrowLeft size={20} />
          </Link>
          <div className="order-title-section">
            <h1 className="order-title">
              Booking {depositOrder?.order_number || (booking?.id ? `#${String(booking.id).slice(0, 8)}` : '')}
              {booking?.payment_kind ? (
                <span className={`order-status-badge status-${booking.payment_kind}`}>
                  {String(booking.payment_kind).replace(/_/g, ' ').toUpperCase()}
                </span>
              ) : null}
            </h1>
            <p className="order-date">
              Created on {booking?.created_at ? new Date(booking.created_at).toLocaleString() : '-'}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="section-card" style={{ color: 'var(--text-muted)' }}>Loading booking...</div>
        ) : error ? (
          <div className="section-card" style={{ color: '#ef4444' }}>{error.message}</div>
        ) : !booking ? (
          <div className="section-card" style={{ color: 'var(--text-muted)' }}>No booking found.</div>
        ) : (
          <div className="order-content">
            <div className="order-main-content">
              <div className="section-card">
                <h3 className="section-title">Course Details</h3>
                <div className="booking-info">
                  <div className="info-item">
                    <div className="info-label">Course</div>
                    <div className="info-value">{booking.course_title || booking.course_slug || '-'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Package</div>
                    <div className="info-value">{booking.selected_package || '-'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Selected Date</div>
                    <div className="info-value">{booking.selected_date || '-'}</div>
                  </div>
                  {booking.course_type === 'in-person' && (
                    <div className="info-item">
                      <div className="info-label">Instructor / Location</div>
                      <div className="info-value">{booking.instructor || '-'}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="section-card">
                <h3 className="section-title">Payment Summary</h3>
                <div className="booking-info">
                  <div className="info-item">
                    <div className="info-label">Amount Paid</div>
                    <div className="info-value">{money(booking.amount_paid_cents)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Amount Still Owed</div>
                    <div className="info-value">{owedCents == null ? '-' : money(owedCents)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">{paidAtLabel}</div>
                    <div className="info-value">{paidAt ? dateTime(paidAt) : '-'}</div>
                  </div>
                </div>
              </div>

              {booking.course_benefit && (
                <div className="section-card">
                  <h3 className="section-title">Petal Paste Course Benefit</h3>
                  <div className="booking-info">
                    <div className="info-item">
                      <div className="info-label">Status</div>
                      <div className="info-value">{String(booking.course_benefit.status).toUpperCase()}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Coupon Code</div>
                      <div className="info-value">{booking.course_benefit.coupon_code}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Expiry</div>
                      <div className="info-value">Never expires</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">Redeemed</div>
                      <div className="info-value">
                        {booking.course_benefit.redeemed_at ? dateTime(booking.course_benefit.redeemed_at) : 'Not yet'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="order-sidebar">
              <div className="section-card">
                <h3 className="sidebar-section-title">
                  <User size={18} />
                  Customer
                </h3>
                <div className="customer-info">
                  <div className="info-item">
                    <div className="info-label">Name</div>
                    <div className="info-value">{booking.buyer_name || '-'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Email</div>
                    {booking.buyer_email ? (
                      <a href={`mailto:${booking.buyer_email}`} className="info-link">
                        {booking.buyer_email}
                      </a>
                    ) : (
                      <div className="info-value">-</div>
                    )}
                  </div>
                  <div className="info-item">
                    <div className="info-label">Phone</div>
                    <div className="info-value">{booking.buyer_phone || '-'}</div>
                  </div>
                </div>
              </div>

              {booking.invoice_url ? (
                <div className="section-card">
                  <h3 className="sidebar-section-title">
                    <FileText size={18} />
                    Invoice
                  </h3>
                  <div className="invoice-section">
                    <div className="info-item" style={{ marginBottom: 12 }}>
                      <div className="info-label">Status</div>
                      <div className="info-value">Invoice Available</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label" style={{ marginBottom: 8 }}>Actions</div>
                      <a
                        href={booking.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                      >
                        <Download size={16} />
                        View/Download Invoice
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="section-card">
                <h3 className="sidebar-section-title">
                  <Trash2 size={18} />
                  Delete
                </h3>
                <button className="btn-danger" onClick={onDelete} disabled={isDeleting}>
                  <Trash2 size={16} />
                  {isDeleting ? 'Deleting...' : 'Delete Booking'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
