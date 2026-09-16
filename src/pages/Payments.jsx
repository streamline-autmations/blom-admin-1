import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ShoppingCart, DollarSign, Package, Target } from 'lucide-react';
import { moneyZAR } from '../components/formatUtils';

// Helper to format numbers
const formatNumber = (num) => {
  if (num == null || isNaN(num)) return '0';
  return new Intl.NumberFormat().format(num);
};

export default function Payments() {
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  // Fetch ALL financial data directly from the unified Backend Function
  const { data: stats, isLoading } = useQuery({
    queryKey: ['finance-stats-unified', selectedPeriod],
    queryFn: async () => {
      try {
        const res = await fetch(`/.netlify/functions/admin-finance-stats?period=${selectedPeriod}`);
        if (!res.ok) {
          console.warn('Finance stats fetch failed:', res.status);
          return {};
        }
        const json = await res.json();
        return json.data || {};
      } catch (err) {
        console.error('Error loading finance stats:', err);
        return {};
      }
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // 🛡️ SAFE DATA MERGING: 
  // Ensure we always have default values even if the API returns an empty object or old data structure.
  const defaults = {
    revenue: 0,
    orders_count: 0,
    items_sold: 0,
    netRevenue: 0,
    profit: 0,
    top_selling_product: 'No sales yet',
    top_selling_count: 0,
    period_label: selectedPeriod === 1 ? 'Today' : `Last ${selectedPeriod} Days`,
    cogs: 0,
    expenses: 0,
    totalDiscounts: 0
  };

  // Merge defaults with fetched stats to guarantee all fields exist
  const data = { ...defaults, ...(stats || {}) };

  // Calculate average order value safely
  const avgOrderValue = data.orders_count > 0 ? data.netRevenue / data.orders_count : 0;

  // Safe string handling for top selling product
  const topProductName = data.top_selling_product || 'No sales yet';
  const displayProductName = topProductName.length > 20 
    ? topProductName.substring(0, 20) + '...'
    : topProductName;

  return (
    <>
      <style>{`
        .sales-header {
          margin-bottom: 32px;
        }

        .header-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-subtitle {
          color: var(--text-muted);
          font-size: 14px;
        }

        .period-selector {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .period-btn {
          padding: 8px 16px;
          border-radius: 8px;
          background: var(--card);
          color: var(--text);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--border);
          transition: all 0.2s ease;
        }

        .period-btn.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .period-btn:hover {
          opacity: 0.8;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .metric-card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          position: relative;
          overflow: hidden;
        }

        .metric-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
        }

        .metric-header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 16px;
        }

        .metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .metric-info {
          flex: 1;
        }

        .metric-label {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 500;
          margin-bottom: 4px;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
        }

        .metric-subtitle {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .profit-positive {
          color: #10b981;
        }

        .profit-negative {
          color: #ef4444;
        }

        .summary-card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          margin-bottom: 24px;
        }

        .summary-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .summary-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .summary-item {
          padding: 12px;
          background: var(--bg);
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .summary-label {
          color: var(--text-muted);
          font-size: 14px;
        }

        .summary-value {
          color: var(--text);
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>

      <div className="p-4 md:p-8">
        <div className="sales-header">
          <h1 className="header-title">
            <TrendingUp className="w-8 h-8" />
            Financial Overview
          </h1>
          <p className="header-subtitle">
            Track net profit and business performance.
          </p>

          <div className="period-selector">
            {[1, 7, 30].map(days => (
              <button
                key={days}
                className={`period-btn ${selectedPeriod === days ? 'active' : ''}`}
                onClick={() => setSelectedPeriod(days)}
              >
                {days === 1 ? 'Today' : `Last ${days} Days`}
              </button>
            ))}
          </div>
        </div>

        {/* Main Sales Metrics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Total Sales</div>
                <div className="metric-value">{moneyZAR(data.revenue)}</div>
                <div className="metric-subtitle">{data.period_label}</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Total Orders</div>
                <div className="metric-value">{formatNumber(data.orders_count)}</div>
                <div className="metric-subtitle">{data.period_label}</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <Target className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Average Order Value</div>
                <div className="metric-value">{moneyZAR(avgOrderValue)}</div>
                <div className="metric-subtitle">Per transaction</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <Package className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Items Sold</div>
                <div className="metric-value">{formatNumber(data.items_sold)}</div>
                <div className="metric-subtitle">Total quantity</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Net Profit</div>
                <div className={`metric-value ${data.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                  {moneyZAR(data.profit)}
                </div>
                <div className="metric-subtitle">{data.period_label}</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <Target className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Top Selling</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>
                  {displayProductName}
                </div>
                <div className="metric-subtitle">{formatNumber(data.top_selling_count)} units sold</div>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="summary-card">
          <h2 className="summary-title">
            <DollarSign className="w-5 h-5" />
            Financial Breakdown ({data.period_label})
          </h2>
          <div className="summary-row">
            <div className="summary-item">
              <span className="summary-label">Gross Revenue</span>
              <span className="summary-value">{moneyZAR(data.revenue)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Discounts</span>
              <span className="summary-value text-red-500">-{moneyZAR(data.totalDiscounts)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Net Revenue</span>
              <span className="summary-value">{moneyZAR(data.netRevenue)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Cost of Goods (COGS)</span>
              <span className="summary-value text-red-500">-{moneyZAR(data.cogs)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Operating Expenses (Est. 10%)</span>
              <span className="summary-value text-red-500">-{moneyZAR(data.expenses)}</span>
            </div>
            <div className="summary-item" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <span className="summary-label font-bold text-gray-900">Net Profit</span>
              <span className={`summary-value font-bold ${data.profit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                {moneyZAR(data.profit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
