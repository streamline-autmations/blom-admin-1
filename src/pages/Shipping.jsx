import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Truck, X, ExternalLink } from "lucide-react";
import { dateTime } from "../components/formatUtils";
import { Banner } from "../components/ui/Banner";

export default function Shipping() {
  const [selectedShipment, setSelectedShipment] = useState(null);

  const { data: shipments = [], isLoading, error } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => base44.entities.Shipment.list('-updated_date'),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list(),
  });

  const getOrder = (orderId) => {
    return orders.find(o => o.id === orderId);
  };

  const hasShipmentsEntity = !error || !error.message?.includes('does not exist');

  if (!hasShipmentsEntity) {
    return (
      <>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Truck className="w-8 h-8" />
            Shipping
          </h1>
        </div>
        <Banner type="info">
          <strong>Connect ShipLogic to enable shipping labels & tracking.</strong>
          <p style={{ marginTop: '8px', fontSize: '13px' }}>
            Expected schema: shipments table with columns: order_id, carrier, service, tracking_number, status (pending|in_transit|delivered|failed), raw (JSON), timestamps.
          </p>
        </Banner>
      </>
    );
  }

  return (
    <>
      <style>{`
        .shipping-header {
          margin-bottom: 32px;
        }

        .header-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .shipments-table {
          background: var(--card);
          border-radius: 20px;
          padding: 0;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          overflow: hidden;
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
          cursor: pointer;
          transition: all 0.2s;
        }

        tbody tr:hover {
          background: rgba(110, 193, 255, 0.05);
        }

        .status-badge {
          display: inline-flex;
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .drawer {
          width: 600px;
          max-width: 90vw;
          height: 100vh;
          background: var(--card);
          box-shadow: -8px 0 16px rgba(0,0,0,0.3);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .drawer-header {
          padding: 24px;
          border-bottom: 2px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .drawer-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }

        .btn-close {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .drawer-section {
          margin-bottom: 32px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }

        .info-label {
          color: var(--text-muted);
        }

        .info-value {
          font-weight: 600;
          color: var(--text);
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-event {
          padding: 16px;
          border-radius: 10px;
          background: var(--bg);
          border-left: 3px solid var(--accent);
        }

        .event-time {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .event-status {
          font-weight: 600;
          color: var(--text);
        }

        .link-order {
          color: var(--accent);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }

        .link-order:hover {
          text-decoration: underline;
        }

        .btn-tracking {
          width: 100%;
          padding: 14px;
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
          justify-content: center;
          gap: 8px;
          text-decoration: none;
        }
      `}</style>

      <div className="shipping-header">
        <h1 className="header-title">
          <Truck className="w-8 h-8" />
          Shipments
        </h1>
      </div>

      <div className="shipments-table">
        <table>
          <thead>
            <tr>
              <th>Shipment #</th>
              <th>Order #</th>
              <th>Carrier</th>
              <th>Tracking</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Loading shipments...
                </td>
              </tr>
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No shipments found
                </td>
              </tr>
            ) : (
              shipments.map(shipment => {
                const order = getOrder(shipment.order_id);
                return (
                  <tr key={shipment.id} onClick={() => setSelectedShipment(shipment)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      #{shipment.id.slice(0, 8)}
                    </td>
                    <td>
                      {order ? order.order_number || `#${order.id.slice(0, 8)}` : shipment.order_id}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{shipment.carrier || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                      {shipment.tracking_number || '—'}
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          background: shipment.status === 'delivered' ? '#10b98120' : shipment.status === 'in_transit' ? '#3b82f620' : '#f59e0b20',
                          color: shipment.status === 'delivered' ? '#10b981' : shipment.status === 'in_transit' ? '#3b82f6' : '#f59e0b'
                        }}
                      >
                        {shipment.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {dateTime(shipment.updated_date)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedShipment && (
        <div className="drawer-overlay" onClick={() => setSelectedShipment(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2 className="drawer-title">Shipment Details</h2>
              <button className="btn-close" onClick={() => setSelectedShipment(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="drawer-content">
              <div className="drawer-section">
                <h3 className="section-title">Information</h3>
                <div className="info-row">
                  <span className="info-label">Shipment ID:</span>
                  <span className="info-value">#{selectedShipment.id.slice(0, 8)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Order:</span>
                  <Link
                    to={createPageUrl(`OrderDetail?id=${selectedShipment.order_id}`)}
                    className="link-order"
                    onClick={() => setSelectedShipment(null)}
                  >
                    {getOrder(selectedShipment.order_id)?.order_number || `#${selectedShipment.order_id.slice(0, 8)}`}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
                <div className="info-row">
                  <span className="info-label">Carrier:</span>
                  <span className="info-value" style={{ textTransform: 'capitalize' }}>
                    {selectedShipment.carrier || 'N/A'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Tracking #:</span>
                  <span className="info-value" style={{ fontFamily: 'monospace' }}>
                    {selectedShipment.tracking_number || 'N/A'}
                  </span>
                </div>
                <div className="info-row" style={{ borderBottom: 'none' }}>
                  <span className="info-label">Status:</span>
                  <span
                    className="status-badge"
                    style={{
                      background: selectedShipment.status === 'delivered' ? '#10b98120' : '#3b82f620',
                      color: selectedShipment.status === 'delivered' ? '#10b981' : '#3b82f6'
                    }}
                  >
                    {selectedShipment.status}
                  </span>
                </div>
              </div>

              {selectedShipment.raw?.events && selectedShipment.raw.events.length > 0 && (
                <div className="drawer-section">
                  <h3 className="section-title">Tracking Timeline</h3>
                  <div className="timeline">
                    {selectedShipment.raw.events.map((event, idx) => (
                      <div key={idx} className="timeline-event">
                        <div className="event-time">{event.timestamp || event.date}</div>
                        <div className="event-status">{event.status || event.description}</div>
                        {event.location && (
                          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {event.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedShipment.tracking_number && (
                <div className="drawer-section">
                  <a
                    href={`https://www.google.com/search?q=${selectedShipment.carrier}+tracking+${selectedShipment.tracking_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-tracking"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Track Package
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}