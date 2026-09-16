import { useState } from "react";
import { moneyZAR } from "./formatUtils";
import { discountLabel } from "./helpers/pricing";
import { useActiveSpecials } from "./hooks/useActiveSpecials";

export default function ProductCard({ product, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const { getDisplayPriceCents } = useActiveSpecials();

  const images = product.images || (product.image_url ? [product.image_url] : []);
  const mainImage = images[0];
  const hoverImage = product.hover_image || images[1];
  const displayImage = isHovered && hoverImage ? hoverImage : mainImage;

  const baseCents = product.price_cents || 0;
  const compareCents = product.compare_at_price_cents;
  const displayCents = getDisplayPriceCents('product', product.id, baseCents);
  
  const originalCents = Math.max(compareCents || 0, baseCents);
  const isDiscounted = displayCents < originalCents;
  const discount = isDiscounted ? discountLabel(originalCents, displayCents) : null;

  const inStock = (product.stock_qty || 0) > 0;

  return (
    <>
      <style>{`
        .product-card {
          background: var(--card);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          position: relative;
        }

        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
        }

        .card-image-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(110, 193, 255, 0.1), rgba(255, 119, 233, 0.1));
        }

        .card-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .product-card:hover .card-image {
          transform: scale(1.05);
        }

        .card-badges {
          position: absolute;
          top: 12px;
          left: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .card-badge {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          backdrop-filter: blur(8px);
        }

        .badge-sale {
          background: #ef444480;
          color: white;
        }

        .badge-out-of-stock {
          background: #6b728080;
          color: white;
        }

        .card-content {
          padding: 20px;
        }

        .card-name {
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-desc {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 16px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-price-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }

        .card-price {
          font-size: 24px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .card-original-price {
          font-size: 16px;
          color: var(--text-muted);
          text-decoration: line-through;
        }

        .card-discount-label {
          font-size: 12px;
          font-weight: 700;
          color: #10b981;
        }
      `}</style>

      <div
        className="product-card"
        onClick={onClick || (() => window.location.href = `/product/${product.slug}`)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="card-image-wrapper">
          {displayImage ? (
            <img src={displayImage} alt={product.name} className="card-image" />
          ) : (
            <div className="card-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
              No image
            </div>
          )}
          
          <div className="card-badges">
            {isDiscounted && <div className="card-badge badge-sale">Sale</div>}
            {!inStock && <div className="card-badge badge-out-of-stock">Out of Stock</div>}
          </div>
        </div>

        <div className="card-content">
          <h3 className="card-name">{product.name || 'Untitled Product'}</h3>
          {product.short_desc && <p className="card-desc">{product.short_desc}</p>}
          
          <div className="card-price-row">
            <div className="card-price">{moneyZAR(displayCents)}</div>
            {isDiscounted && (
              <>
                <div className="card-original-price">{moneyZAR(originalCents)}</div>
                {discount && (
                  <div className="card-discount-label">
                    –{discount.pct}% • save {moneyZAR(discount.amountCents)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}