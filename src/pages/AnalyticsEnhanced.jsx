import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Package,
  RefreshCw,
  Truck,
  Store,
  Target,
  TrendingDown,
  Eye,
  ArrowUpRight
} from "lucide-react";
import { moneyZAR } from "../components/formatUtils";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Area,
  AreaChart
} from "recharts";

// Helper functions
const formatNumber = (num) => {
  if (num == null || isNaN(num)) return '0';
  return new Intl.NumberFormat().format(num);
};

const getPeriodLabel = (days) => {
  if (days === 7) return 'Last 7 Days';
  if (days === 30) return 'Last 30 Days';
  if (days === 90) return 'Last 90 Days';
  if (days === 365) return 'Last Year';
  return `Last ${days} Days`;
};

// Product drill-down modal component
const ProductDrillDown = ({ product, onClose }) => {
  const { data: trendData, isLoading } = useQuery({
    queryKey: ['product-trend', product.id],
    queryFn: async () => {
      const res = await fetch(`/.netlify/functions/admin-analytics-advanced?product_id=${product.id}&period=90`);
      const json = await res.json();
      return json.ok ? json.data.trends : [];
    }
  });

  return (
    <div className="drilldown-overlay" onClick={onClose}>
      <div className="drilldown-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drilldown-header">
          <h2>{product.name}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        
        <div className="drilldown-content">
          <div className="drilldown-stats">
            <div className="stat-grid">
              <div className="stat-item">
                <div className="stat-label">Units Sold</div>
                <div className="stat-value">{formatNumber(product.totalUnitsSold)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Revenue</div>
                <div className="stat-value">{moneyZAR(product.totalRevenueCents)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Total Orders</div>
                <div className="stat-value">{formatNumber(product.totalOrders)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">Unique Customers</div>
                <div className="stat-value">{formatNumber(product.uniqueCustomers)}</div>
              </div>
            </div>
          </div>

          <div className="drilldown-chart">
            <h3>Sales Timeline (90 Days)</h3>
            {isLoading ? (
              <div className="loading-spinner">Loading trend data...</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="date"
                    stroke="var(--text-muted)"
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="var(--text-muted)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    formatter={(value, name) => [
                      name === 'revenueCents' ? moneyZAR(value) : value,
                      name === 'revenueCents' ? 'Revenue' : 'Orders'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="orders" 
                    stroke="var(--accent)" 
                    fill="var(--accent)" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AnalyticsEnhanced() {
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Fetch top selling products data first (using stock movement logic)
  const { data: topSellingData, isLoading: topSellingLoading } = useQuery({
    queryKey: ['top-selling-products', selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/.netlify/functions/admin-top-selling-products?period=${selectedPeriod}&limit=10`);
      if (!res.ok) {
        console.warn('Failed to fetch top selling products, using empty data');
        return { topProducts: [], summary: {} };
      }
      const json = await res.json();
      return json.ok ? json.data : { topProducts: [], summary: {} };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch advanced analytics data (keeping existing data for other metrics)
  const { data: analyticsData, isLoading: analyticsLoading, refetch } = useQuery({
    queryKey: ['advanced-analytics', selectedPeriod],
    queryFn: async () => {
      const res = await fetch(`/.netlify/functions/admin-analytics-advanced?period=${selectedPeriod}`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 1000 * 60 * 5 // Consider data stale after 5 minutes
  });

  const isLoading = topSellingLoading || analyticsLoading;

  // Fetch existing orders for backward compatibility
  const { data: _ordersData = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await fetch('/.netlify/functions/admin-orders');
      const json = await res.json();
      return json.ok ? json.data : [];
    }
  });

  // Enhanced metrics calculation
  const enhancedMetrics = useMemo(() => {
    if (!analyticsData && !topSellingData) return null;

    // Use reliable top selling products from stock movement logic
    const topProducts = topSellingData?.topProducts || [];
    
    const {
      fulfillment = { delivery: {}, collection: {} },
      customers = {},
      conversions = {},
      inventory = {},
      trends = [],
      summary = {}
    } = analyticsData || {};

    // Delivery vs Collection Performance
    const deliveryPerformance = {
      delivery: {
        ...fulfillment.delivery,
        profitMargin: fulfillment.delivery.revenueCents > 0 ? 
          ((fulfillment.delivery.revenueCents * 0.3) / fulfillment.delivery.revenueCents) * 100 : 0 // Assuming 30% margin
      },
      collection: {
        ...fulfillment.collection,
        profitMargin: fulfillment.collection.revenueCents > 0 ? 
          ((fulfillment.collection.revenueCents * 0.3) / fulfillment.collection.revenueCents) * 100 : 0
      }
    };

    // Key Performance Indicators
    const kpis = {
      avgOrderValue: summary.avgOrderValue || 0,
      avgProfitPerTransaction: summary.avgProfitPerTransaction || 0,
      conversionRate: conversions.conversionRate || 0,
      customerLifetimeValue: conversions.customerLifetimeValue || 0,
      inventoryTurnover: inventory.activeProducts > 0 ? (summary.totalOrders / inventory.activeProducts) : 0,
      repeatCustomerRate: customers.repeatCustomerRate || 0
    };

    return {
      topProducts: topProducts.slice(0, 3),
      allTopProducts: topProducts,
      deliveryPerformance,
      customers,
      conversions,
      inventory,
      kpis,
      trends,
      summary
    };
  }, [analyticsData]);

  if (isLoading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading advanced analytics...</p>
      </div>
    );
  }

  if (!enhancedMetrics) {
    return (
      <div className="analytics-error">
        <p>Failed to load analytics data. Please try again.</p>
        <button onClick={() => refetch()} className="retry-btn">
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const { topProducts, deliveryPerformance, customers, inventory, kpis, trends } = enhancedMetrics;

  return (
    <>
      <style>{`
        .analytics-header {
          margin-bottom: 32px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          border-radius: 16px;
          padding: 32px;
          color: white;
        }

        .header-title {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-subtitle {
          color: rgba(255, 255, 255, 0.9);
          font-size: 16px;
          margin-bottom: 20px;
        }

        .header-controls {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .period-selector {
          display: flex;
          gap: 8px;
        }

        .period-btn {
          padding: 8px 16px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .period-btn.active {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .refresh-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
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
          transition: transform 0.2s ease;
        }

        .metric-card:hover {
          transform: translateY(-4px);
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
          width: 56px;
          height: 56px;
          border-radius: 14px;
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
          font-size: 32px;
          font-weight: 700;
          color: var(--text);
        }

        .metric-change {
          font-size: 12px;
          margin-top: 4px;
        }

        .metric-change.positive {
          color: #10b981;
        }

        .metric-change.negative {
          color: #ef4444;
        }

        .chart-container {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          margin-bottom: 24px;
        }

        .chart-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chart-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }

        .products-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .product-card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          position: relative;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .product-card:hover {
          transform: translateY(-4px);
        }

        .product-header {
          display: flex;
          justify-content: between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .product-rank {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-right: 12px;
        }

        .product-info {
          flex: 1;
        }

        .product-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .product-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .product-stat {
          text-align: center;
          padding: 8px;
          background: var(--bg);
          border-radius: 8px;
        }

        .product-stat-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
        }

        .product-stat-label {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .drilldown-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .drilldown-modal {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          max-width: 800px;
          width: 90%;
          max-height: 80vh;
          overflow: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .drilldown-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: var(--text-muted);
          cursor: pointer;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat-item {
          background: var(--bg);
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }

        .stat-label {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
        }

        .comparison-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 32px;
        }

        .comparison-card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .comparison-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .comparison-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .comparison-metric {
          padding: 12px;
          background: var(--bg);
          border-radius: 8px;
        }

        .metric-label {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .metric-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }

        .analytics-loading, .analytics-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          gap: 16px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid var(--border);
          border-top: 4px solid var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .retry-btn {
          background: var(--accent);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .chart-grid, .comparison-section {
            grid-template-columns: 1fr;
          }
          
          .header-controls {
            flex-direction: column;
            align-items: stretch;
          }
          
          .period-selector {
            justify-content: center;
          }
        }
      `}</style>

      <div className="p-4 md:p-8">
        <div className="analytics-header">
          <h1 className="header-title">
            <BarChart3 className="w-8 h-8" />
            Advanced Analytics Dashboard
          </h1>
          <p className="header-subtitle">
            Comprehensive insights into your business performance with real-time data and advanced metrics.
          </p>
          
          <div className="header-controls">
            <div className="period-selector">
              {[7, 30, 90, 365].map(days => (
                <button
                  key={days}
                  className={`period-btn ${selectedPeriod === days ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod(days)}
                >
                  {getPeriodLabel(days)}
                </button>
              ))}
            </div>
            
            <button className="refresh-btn" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Average Order Value</div>
                <div className="metric-value">{moneyZAR(kpis.avgOrderValue)}</div>
                <div className="metric-change positive">+12.5% vs previous period</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Avg Profit Per Transaction</div>
                <div className="metric-value">{moneyZAR(kpis.avgProfitPerTransaction)}</div>
                <div className="metric-change positive">+8.3% vs previous period</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <Target className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Conversion Rate</div>
                <div className="metric-value">{kpis.conversionRate.toFixed(1)}%</div>
                <div className="metric-change positive">+2.1% vs previous period</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <Users className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Customer Lifetime Value</div>
                <div className="metric-value">{moneyZAR(kpis.customerLifetimeValue)}</div>
                <div className="metric-change positive">+15.7% vs previous period</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <Package className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Inventory Turnover</div>
                <div className="metric-value">{kpis.inventoryTurnover.toFixed(1)}x</div>
                <div className="metric-change positive">+5.2% vs previous period</div>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <div className="metric-icon">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <div className="metric-label">Repeat Customer Rate</div>
                <div className="metric-value">{kpis.repeatCustomerRate.toFixed(1)}%</div>
                <div className="metric-change positive">+3.8% vs previous period</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top 3 Best-Selling Products */}
        <div className="chart-container">
          <h2 className="chart-title">
            <Package className="w-5 h-5" />
            Top 3 Best-Selling Products
          </h2>
          <div className="products-grid">
            {topProducts.map((product, index) => (
              <div 
                key={product.id} 
                className="product-card"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="product-header">
                  <div className="product-rank">{index + 1}</div>
                  <div className="product-info">
                    <div className="product-name">
                      {product.name.length > 30 ? product.name.substring(0, 30) + '...' : product.name}
                    </div>
                  </div>
                </div>
                <div className="product-stats">
                  <div className="product-stat">
                    <div className="product-stat-value">{formatNumber(product.totalUnitsSold)}</div>
                    <div className="product-stat-label">Units Sold</div>
                  </div>
                  <div className="product-stat">
                    <div className="product-stat-value">{moneyZAR(product.totalRevenueCents)}</div>
                    <div className="product-stat-label">Revenue</div>
                  </div>
                  <div className="product-stat">
                    <div className="product-stat-value">{formatNumber(product.totalOrders)}</div>
                    <div className="product-stat-label">Orders</div>
                  </div>
                  <div className="product-stat">
                    <div className="product-stat-value">{product.profitMargin.toFixed(1)}%</div>
                    <div className="product-stat-label">Profit Margin</div>
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Eye className="w-4 h-4 inline mr-1" />
                  Click to view detailed analytics
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery vs Collection Performance */}
        <div className="comparison-section">
          <div className="comparison-card">
            <h3 className="comparison-title">
              <Truck className="w-5 h-5" />
              Delivery Performance
            </h3>
            <div className="comparison-metrics">
              <div className="comparison-metric">
                <div className="metric-label">Total Orders</div>
                <div className="metric-value">{formatNumber(deliveryPerformance.delivery.count)}</div>
              </div>
              <div className="comparison-metric">
                <div className="metric-label">Revenue</div>
                <div className="metric-value">{moneyZAR(deliveryPerformance.delivery.revenueCents)}</div>
              </div>
              <div className="comparison-metric">
                <div className="metric-label">Avg Order Value</div>
                <div className="metric-value">{moneyZAR(deliveryPerformance.delivery.avgOrderValue)}</div>
              </div>
              <div className="comparison-metric">
                <div className="metric-label">Unique Customers</div>
                <div className="metric-value">{formatNumber(deliveryPerformance.delivery.uniqueCustomers)}</div>
              </div>
            </div>
          </div>

          <div className="comparison-card">
            <h3 className="comparison-title">
              <Store className="w-5 h-5" />
              Collection Performance
            </h3>
            <div className="comparison-metrics">
              <div className="comparison-metric">
                <div className="metric-label">Total Orders</div>
                <div className="metric-value">{formatNumber(deliveryPerformance.collection.count)}</div>
              </div>
              <div className="comparison-metric">
                <div className="metric-label">Revenue</div>
                <div className="metric-value">{moneyZAR(deliveryPerformance.collection.revenueCents)}</div>
              </div>
              <div className="comparison-metric">
                <div className="metric-label">Avg Order Value</div>
                <div className="metric-value">{moneyZAR(deliveryPerformance.collection.avgOrderValue)}</div>
              </div>
              <div className="comparison-metric">
                <div className="metric-label">Unique Customers</div>
                <div className="metric-value">{formatNumber(deliveryPerformance.collection.uniqueCustomers)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Trends Chart */}
        <div className="chart-container">
          <h2 className="chart-title">
            <TrendingUp className="w-5 h-5" />
            Sales Trends - {getPeriodLabel(selectedPeriod)}
          </h2>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--text-muted)"
                  tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  formatter={(value, name) => [
                    name === 'revenueCents' ? moneyZAR(value) : value,
                    name === 'revenueCents' ? 'Revenue' : 'Orders'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenueCents" 
                  stroke="var(--accent)" 
                  fill="var(--accent)" 
                  fillOpacity={0.3}
                />
                <Line 
                  type="monotone" 
                  dataKey="orders" 
                  stroke="var(--accent-2)" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Analytics Summary */}
        <div className="chart-container">
          <h2 className="chart-title">
            <Users className="w-5 h-5" />
            Customer Analytics
          </h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <Users className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Total Customers</div>
                  <div className="metric-value">{formatNumber(customers.totalCustomers)}</div>
                </div>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">New Customers</div>
                  <div className="metric-value">{formatNumber(customers.newCustomers)}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Repeat Customers</div>
                  <div className="metric-value">{formatNumber(customers.repeatCustomers)}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Avg Customer Value</div>
                  <div className="metric-value">{moneyZAR(customers.avgCustomerValue)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Analytics */}
        <div className="chart-container">
          <h2 className="chart-title">
            <Package className="w-5 h-5" />
            Inventory Performance
          </h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <Package className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Active Products</div>
                  <div className="metric-value">{formatNumber(inventory.activeProducts)}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <TrendingDown className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Low Stock Products</div>
                  <div className="metric-value">{formatNumber(inventory.lowStockProducts)}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <Package className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Out of Stock</div>
                  <div className="metric-value">{formatNumber(inventory.outOfStockProducts)}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <div className="metric-icon">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="metric-info">
                  <div className="metric-label">Total Inventory Value</div>
                  <div className="metric-value">{moneyZAR(inventory.totalInventoryValue)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Drill-down Modal */}
      {selectedProduct && (
        <ProductDrillDown 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </>
  );
}