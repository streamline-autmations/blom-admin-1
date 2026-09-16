import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from "lucide-react";

function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, loading }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="stat-icon">
          <Icon className="w-6 h-6" />
        </div>
        <div className="stat-info">
          <div className="stat-title">{title}</div>
          <div className="stat-value">
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-gray-300" /> : value}
          </div>
        </div>
      </div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`stat-trend ${trendUp ? 'trend-up' : 'trend-down'}`}>
          {trendUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

function QuickLink({ title, description, url, icon: Icon }) {
  return (
    <Link to={createPageUrl(url)} className="quick-link">
      <div className="quick-link-icon">
        <Icon className="w-5 h-5" />
      </div>
      <div className="quick-link-content">
        <div className="quick-link-title">{title}</div>
        <div className="quick-link-description">{description}</div>
      </div>
      <ArrowUpRight className="w-5 h-5 quick-link-arrow" />
    </Link>
  );
}

export default function Dashboard() {
  // 1. Fetch Today's Financials (Same logic as Payments Page)
  const { data: todayStats, isLoading: isLoadingToday } = useQuery({
    queryKey: ['admin-finance-stats', 'today'],
    queryFn: async () => {
      const res = await fetch('/.netlify/functions/admin-finance-stats?period=today');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    }
  });

  // 2. Fetch General Analytics (For Total Orders & Top Product)
  const { data: analyticsData, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['admin-analytics-advanced', '30'],
    queryFn: async () => {
      // Fetching last 30 days to get recent top products
      const res = await fetch('/.netlify/functions/admin-analytics-advanced?period=30');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      return json.data;
    }
  });

  // 3. Fetch Recent Products directly from Admin API
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['admin-products-recent'],
    queryFn: async () => {
      const res = await fetch('/.netlify/functions/admin-products?page=1&pageSize=5');
      const json = await res.json();
      return json.data || [];
    }
  });

  // Safe Data Access
  const todaySales = todayStats?.revenue || 0;
  const todayProfit = todayStats?.profit || 0;
  const totalOrders = analyticsData?.summary?.totalOrders || 0; // Orders in last 30 days (active metric)
  const topProduct = analyticsData?.topProducts?.[0];
  
  return (
    <>
      <style>{`
        .dashboard-header {
          margin-bottom: 32px;
        }

        .dashboard-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .dashboard-subtitle {
          color: var(--text-muted);
          font-size: 14px;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }

        @media (min-width: 640px) {
          .dashboard-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
        }

        @media (min-width: 1024px) {
          .dashboard-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
          }
        }

        .stat-card {
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          position: relative;
          overflow: hidden;
        }

        .stat-card.revenue::before {
          background: linear-gradient(90deg, #10b981, #34d399);
        }

        .stat-card.profit::before {
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
        }

        .stat-card.orders::before {
          background: linear-gradient(90deg, #8b5cf6, #a78bfa);
        }

        .stat-card.product::before {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .stat-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 12px;
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--card);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .stat-info {
          flex: 1;
        }

        .stat-title {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 500;
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
        }

        .stat-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 8px;
        }

        .stat-trend {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .trend-up {
          background: #16a34a20;
          color: #16a34a;
        }

        .trend-down {
          background: #dc262620;
          color: #dc2626;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin: 32px 0 20px 0;
        }

        .quick-links-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }

        @media (min-width: 640px) {
          .quick-links-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 1024px) {
          .quick-links-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .quick-link {
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          text-decoration: none;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          transition: all 0.2s ease;
        }

        .quick-link:hover {
          transform: translateY(-2px);
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }

        .quick-link-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--card);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          transition: all 0.2s ease;
        }

        .quick-link:hover .quick-link-icon {
          color: var(--accent);
          transform: scale(1.05);
        }

        .quick-link-content {
          flex: 1;
        }

        .quick-link-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 2px;
        }

        .quick-link-description {
          font-size: 13px;
          color: var(--text-muted);
        }

        .quick-link-arrow {
          color: var(--text-muted);
        }

        .recent-table {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          overflow: hidden;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .table-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
        }

        .view-all-link {
          font-size: 14px;
          color: var(--accent);
          text-decoration: none;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          border-radius: 8px;
          background: var(--card);
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          transition: all 0.2s ease;
        }

        .view-all-link:hover {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          transform: translateY(-1px);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          text-align: left;
          padding: 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          border-bottom: 1px solid var(--border);
        }

        td {
          padding: 16px 12px;
          color: var(--text);
          border-bottom: 1px solid var(--border);
          font-size: 14px;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover {
          background: rgba(110, 193, 255, 0.05);
        }

        .status-badge {
          display: inline-flex;
          padding: 4px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .status-active {
          background: #16a34a20;
          color: #16a34a;
        }

        .status-archived {
          background: #6b728020;
          color: #6b7280;
        }
      `}</style>

      <div className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        <p className="dashboard-subtitle">Overview of your business performance</p>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card revenue">
          <StatCard
            title="Today's Sales"
            value={`R${(todaySales / 100).toFixed(2)}`}
            subtitle="Net Revenue"
            icon={DollarSign}
            trend={todaySales > 0 ? "Active" : "No Sales"}
            trendUp={todaySales > 0}
            loading={isLoadingToday}
          />
        </div>
        
        <div className="stat-card profit">
          <StatCard
            title="Today's Profit"
            value={`R${(todayProfit / 100).toFixed(2)}`}
            subtitle="After Est. Costs"
            icon={TrendingUp}
            trend={todayProfit > 0 ? "Positive" : "-"}
            trendUp={todayProfit > 0}
            loading={isLoadingToday}
          />
        </div>
        
        <div className="stat-card orders">
          <StatCard
            title="Orders (30 Days)"
            value={totalOrders}
            subtitle="Monthly Volume"
            icon={ShoppingCart}
            loading={isLoadingAnalytics}
          />
        </div>
        
        <div className="stat-card product">
          <StatCard
            title="Top Product"
            value={topProduct ? topProduct.name : 'N/A'}
            subtitle={topProduct ? `${topProduct.totalUnitsSold} sold` : 'No data'}
            icon={Package}
            loading={isLoadingAnalytics}
          />
        </div>
      </div>

      <div className="section-title">Quick Actions</div>
      <div className="quick-links-grid">
        <QuickLink
          title="View Orders"
          description="Manage recent orders"
          url="Orders"
          icon={ShoppingCart}
        />
        <QuickLink
          title="Products"
          description="Manage inventory"
          url="Products"
          icon={Package}
        />
        <QuickLink
          title="View Reports"
          description="View reports"
          url="Analytics"
          icon={DollarSign}
        />
        <QuickLink
          title="Stock"
          description="Manual adjustments"
          url="Stock"
          icon={TrendingUp}
        />
      </div>

      <div className="section-title">Recent Products</div>
      <div className="recent-table">
        <div className="table-header">
          <div className="table-title">Latest Inventory</div>
          <Link to={createPageUrl("Products")} className="view-all-link">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingProducts ? (
                <tr><td colSpan="4" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading products...</td></tr>
              ) : (productsData || []).map(product => (
                <tr key={product.id}>
                  <td className="font-medium">{product.name}</td>
                  <td>
                    <span className={`status-badge status-${product.status}`}>
                      {product.status}
                    </span>
                  </td>
                  <td>R{((product.price_cents || 0) / 100).toFixed(2)}</td>
                  <td>{product.stock_qty || 0}</td>
                </tr>
              ))}
              {!isLoadingProducts && (productsData || []).length === 0 && (
                <tr><td colSpan="4" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
