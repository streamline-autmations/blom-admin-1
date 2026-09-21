import { useState } from "react";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";

export default function PriceDropdown({ currentPrice, onPriceChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [customPrice, setCustomPrice] = useState("");

  const adjustPrice = (percentage) => {
    const newPrice = Math.max(1, Math.round(currentPrice * (1 + percentage / 100)));
    onPriceChange(newPrice);
  };

  const setExactPrice = () => {
    const cents = Math.round(parseFloat(customPrice) * 100);
    if (!isNaN(cents) && cents > 0) {
      onPriceChange(cents);
      setCustomPrice("");
      setIsOpen(false);
    }
  };

  return (
    <>
      <style>{`
        .price-dropdown {
          margin-top: 16px;
        }

        .price-dropdown-trigger {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: all 0.2s;
        }

        .price-dropdown-trigger:hover {
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .price-dropdown-trigger:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .price-dropdown-content {
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          margin-top: 12px;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
        }

        .price-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }

        .btn-price {
          padding: 12px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
          transition: all 0.2s;
        }

        .btn-price:hover {
          box-shadow: 5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light);
        }

        .btn-price:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .btn-price.increase {
          color: #10b981;
        }

        .btn-price.decrease {
          color: #ef4444;
        }

        .set-price-section {
          border-top: 1px solid var(--border);
          padding-top: 16px;
          margin-top: 8px;
        }

        .set-price-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .set-price-group {
          display: flex;
          gap: 8px;
        }

        .set-price-input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 10px;
          border: none;
          background: var(--card);
          color: var(--text);
          font-size: 14px;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .set-price-input:focus {
          outline: none;
        }

        .set-price-btn {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 3px 3px 6px var(--shadow-dark), -3px -3px 6px var(--shadow-light);
        }

        .set-price-btn:active {
          box-shadow: inset 2px 2px 4px rgba(0,0,0,0.3);
        }
      `}</style>

      <div className="price-dropdown">
        <button
          type="button"
          className="price-dropdown-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>Quick Price Adjustments</span>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {isOpen && (
          <div className="price-dropdown-content">
            <div className="price-actions">
              <button type="button" className="btn-price increase" onClick={() => adjustPrice(5)}>
                <TrendingUp className="w-4 h-4" />
                +5%
              </button>
              <button type="button" className="btn-price increase" onClick={() => adjustPrice(10)}>
                <TrendingUp className="w-4 h-4" />
                +10%
              </button>
              <button type="button" className="btn-price decrease" onClick={() => adjustPrice(-5)}>
                <TrendingDown className="w-4 h-4" />
                −5%
              </button>
              <button type="button" className="btn-price decrease" onClick={() => adjustPrice(-10)}>
                <TrendingDown className="w-4 h-4" />
                −10%
              </button>
            </div>

            <div className="set-price-section">
              <div className="set-price-label">Set exact price</div>
              <div className="set-price-group">
                <input
                  type="number"
                  className="set-price-input"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Amount in ZAR"
                  step="0.01"
                  min="0.01"
                />
                <button type="button" className="set-price-btn" onClick={setExactPrice}>
                  Set
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}