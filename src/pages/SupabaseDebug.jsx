import { useState, useEffect } from "react";
import { supabase } from "../components/supabaseClient";
import { CheckCircle, XCircle, AlertCircle, Loader } from "lucide-react";
import { Banner } from "../components/ui/Banner";

export default function SupabaseDebug() {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  // Check env vars
  const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
  const hasKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  const urlLast8 = import.meta.env.VITE_SUPABASE_URL?.slice(-8) || '';
  const urlMasked = import.meta.env.VITE_SUPABASE_URL 
    ? `${'*'.repeat(import.meta.env.VITE_SUPABASE_URL.length - 8)}${urlLast8}`
    : 'Not set';

  // Parse project ref from URL
  let projectRef = '—';
  if (import.meta.env.VITE_SUPABASE_URL) {
    try {
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      const parts = url.hostname.split('.');
      if (parts.length > 0 && parts[parts.length - 2] === 'supabase') {
        projectRef = parts[0];
      }
    } catch {
      // Invalid URL
    }
  }

  useEffect(() => {
    checkAuth();
    fetchProducts();
  }, []);

  const checkAuth = async () => {
    if (!supabase) {
      setAuthError('Supabase client not initialized (check env vars or package)');
      setAuthLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      setAuthUser(data.user);
      setAuthError(null);
    } catch (err) {
      setAuthError(err.message);
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchProducts = async () => {
    if (!supabase) {
      setProductsError('Supabase client not initialized');
      setProductsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, status, stock_qty')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setProducts(data || []);
      setProductsError(null);
    } catch (err) {
      setProductsError(err.message || 'Unknown error');
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const isRLSError = productsError && (
    productsError.includes('permission denied') || 
    productsError.includes('PGRST301') ||
    productsError.includes('RLS')
  );

  return (
    <>
      <style>{`
        .debug-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .debug-header {
          margin-bottom: 32px;
        }

        .debug-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .debug-subtitle {
          color: var(--text-muted);
          font-size: 14px;
        }

        .debug-section {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .section-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .check-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }

        .check-item:last-child {
          border-bottom: none;
        }

        .check-label {
          flex: 1;
          font-size: 14px;
          color: var(--text);
          font-weight: 500;
        }

        .check-value {
          font-size: 14px;
          color: var(--text-muted);
          font-family: monospace;
        }

        .status-icon {
          flex-shrink: 0;
        }

        .status-success {
          color: #10b981;
        }

        .status-error {
          color: #ef4444;
        }

        .status-loading {
          color: var(--accent);
        }

        .products-list {
          margin-top: 16px;
        }

        .product-item {
          padding: 12px 16px;
          background: var(--bg);
          border-radius: 10px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .product-name {
          font-weight: 600;
          color: var(--text);
          font-size: 14px;
        }

        .product-meta {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .product-stock {
          font-size: 13px;
          color: var(--text-muted);
          font-weight: 600;
        }

        .error-box {
          background: #ef444420;
          border-left: 4px solid #ef4444;
          padding: 12px 16px;
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
          font-family: monospace;
          margin-top: 12px;
        }

        .loading-state {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          color: var(--text-muted);
          font-size: 14px;
        }

        .empty-state {
          text-align: center;
          padding: 24px;
          color: var(--text-muted);
          font-size: 14px;
        }
      `}</style>

      <div className="debug-container">
        <div className="debug-header">
          <h1 className="debug-title">Supabase Debug</h1>
          <p className="debug-subtitle">Diagnostics for Supabase connection and data access</p>
        </div>

        <div className="debug-section">
          <h2 className="section-title">
            <AlertCircle className="w-5 h-5" />
            Environment Variables
          </h2>
          
          <div className="check-item">
            <div className="status-icon">
              {hasUrl ? (
                <CheckCircle className="w-5 h-5 status-success" />
              ) : (
                <XCircle className="w-5 h-5 status-error" />
              )}
            </div>
            <div className="check-label">VITE_SUPABASE_URL</div>
            <div className="check-value">{hasUrl ? urlMasked : 'Not set'}</div>
          </div>

          <div className="check-item">
            <div className="status-icon">
              {hasKey ? (
                <CheckCircle className="w-5 h-5 status-success" />
              ) : (
                <XCircle className="w-5 h-5 status-error" />
              )}
            </div>
            <div className="check-label">VITE_SUPABASE_ANON_KEY</div>
            <div className="check-value">{hasKey ? 'Set' : 'Not set'}</div>
          </div>

          <div className="check-item">
            <div className="status-icon">
              {projectRef !== '—' ? (
                <CheckCircle className="w-5 h-5 status-success" />
              ) : (
                <AlertCircle className="w-5 h-5 status-error" />
              )}
            </div>
            <div className="check-label">Project Ref</div>
            <div className="check-value">{projectRef}</div>
          </div>

          <div className="check-item">
            <div className="status-icon">
              {supabase ? (
                <CheckCircle className="w-5 h-5 status-success" />
              ) : (
                <XCircle className="w-5 h-5 status-error" />
              )}
            </div>
            <div className="check-label">Supabase Client</div>
            <div className="check-value">{supabase ? 'Initialized' : 'Not initialized'}</div>
          </div>
        </div>

        <div className="debug-section">
          <h2 className="section-title">
            <AlertCircle className="w-5 h-5" />
            Authentication
          </h2>

          {authLoading ? (
            <div className="loading-state">
              <Loader className="w-5 h-5 status-loading animate-spin" />
              Checking auth...
            </div>
          ) : authError ? (
            <>
              <div className="check-item">
                <div className="status-icon">
                  <XCircle className="w-5 h-5 status-error" />
                </div>
                <div className="check-label">Status</div>
                <div className="check-value">Error</div>
              </div>
              <div className="error-box">{authError}</div>
            </>
          ) : authUser ? (
            <div className="check-item">
              <div className="status-icon">
                <CheckCircle className="w-5 h-5 status-success" />
              </div>
              <div className="check-label">User ID</div>
              <div className="check-value">{authUser.id}</div>
            </div>
          ) : (
            <div className="check-item">
              <div className="status-icon">
                <AlertCircle className="w-5 h-5 status-error" />
              </div>
              <div className="check-label">Status</div>
              <div className="check-value">Not authenticated</div>
            </div>
          )}
        </div>

        <div className="debug-section">
          <h2 className="section-title">
            <AlertCircle className="w-5 h-5" />
            Products Query
          </h2>

          {isRLSError && (
            <Banner type="warning" style={{ marginBottom: '16px' }}>
              RLS is blocking reads. Make your user owner/staff in profiles.app_role, or add a temporary read policy.
            </Banner>
          )}

          {productsLoading ? (
            <div className="loading-state">
              <Loader className="w-5 h-5 status-loading animate-spin" />
              Loading products...
            </div>
          ) : productsError ? (
            <>
              <div className="check-item">
                <div className="status-icon">
                  <XCircle className="w-5 h-5 status-error" />
                </div>
                <div className="check-label">Status</div>
                <div className="check-value">Error</div>
              </div>
              <div className="error-box">{productsError}</div>
            </>
          ) : products.length === 0 ? (
            <div className="empty-state">No products found (query successful, but table is empty)</div>
          ) : (
            <>
              <div className="check-item">
                <div className="status-icon">
                  <CheckCircle className="w-5 h-5 status-success" />
                </div>
                <div className="check-label">Found {products.length} products</div>
              </div>
              <div className="products-list">
                {products.map(product => (
                  <div key={product.id} className="product-item">
                    <div>
                      <div className="product-name">{product.name}</div>
                      <div className="product-meta">
                        {product.slug} • {product.status}
                      </div>
                    </div>
                    <div className="product-stock">Stock: {product.stock_qty || 0}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}