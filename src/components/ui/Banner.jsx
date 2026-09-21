import { AlertCircle, Info } from 'lucide-react';

export function Banner({ type = 'info', children }) {
  return (
    <>
      <div className={`banner banner-${type}`}>
        {type === 'error' && <AlertCircle className="w-5 h-5" />}
        {type === 'info' && <Info className="w-5 h-5" />}
        {type === 'warning' && <AlertCircle className="w-5 h-5" />}
        <div className="banner-content">{children}</div>
      </div>
      <style>{`
        .banner {
          background: var(--card);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 24px;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
        }

        .banner-error {
          border-left: 4px solid #ef4444;
          color: #ef4444;
        }

        .banner-info {
          border-left: 4px solid var(--accent);
          color: var(--accent);
        }

        .banner-warning {
          border-left: 4px solid #f59e0b;
          color: #f59e0b;
        }

        .banner-content {
          flex: 1;
          color: var(--text);
          font-size: 14px;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}