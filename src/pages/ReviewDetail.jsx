import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Star, Check, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "../components/ui/ToastProvider";
import { Banner } from "../components/ui/Banner";

export default function ReviewDetail() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const reviewId = urlParams.get('id');

  const { data: review, isLoading, error } = useQuery({
    queryKey: ['review', reviewId],
    queryFn: async () => {
      const response = await fetch(`/.netlify/functions/admin-review?id=${reviewId}`);
      if (!response.ok) throw new Error('Failed to load review');
      const json = await response.json();
      return json.review;
    },
    enabled: !!reviewId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ patch }) => {
      const response = await fetch('/.netlify/functions/admin-review-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reviewId, status: patch.status })
      });
      if (!response.ok) throw new Error('Failed to update review');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', reviewId] });
      showToast('success', 'Review updated');
      setTimeout(() => navigate(createPageUrl('Reviews')), 1000);
    },
    onError: (error) => {
      showToast('error', error.message || 'Failed to update review');
    },
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        Loading review...
      </div>
    );
  }

  if (error || !review) {
    return <Banner type="error">{error?.message || 'Review not found'}</Banner>;
  }

  const renderStars = (rating) => {
    return (
      <div style={{ display: 'flex', gap: '6px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            className="w-6 h-6"
            fill={i <= rating ? '#f59e0b' : 'none'}
            stroke={i <= rating ? '#f59e0b' : 'var(--text-muted)'}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .detail-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }

        .btn-back {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: none;
          background: var(--card);
          color: var(--text);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .btn-back:active {
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
        }

        .detail-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
          flex: 1;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-action {
          padding: 12px 24px;
          border-radius: 12px;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          transition: all 0.2s;
        }

        .btn-approve {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
        }

        .btn-reject {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
        }

        .btn-action:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-action:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .review-card {
          background: var(--card);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          max-width: 800px;
        }

        .review-header {
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 2px solid var(--border);
        }

        .product-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
        }

        .review-author {
          font-size: 20px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 12px;
        }

        .review-rating {
          margin-bottom: 12px;
        }

        .review-date {
          font-size: 13px;
          color: var(--text-muted);
        }

        .status-badge {
          display: inline-flex;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          box-shadow: inset 2px 2px 4px var(--shadow-dark), inset -2px -2px 4px var(--shadow-light);
          margin-left: 12px;
        }

        .status-pending {
          background: #3b82f620;
          color: #3b82f6;
        }

        .status-approved {
          background: #10b98120;
          color: #10b981;
        }

        .status-rejected {
          background: #ef444420;
          color: #ef4444;
        }

        .review-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 16px;
        }

        .review-body {
          font-size: 16px;
          color: var(--text);
          line-height: 1.7;
          margin-bottom: 24px;
          background: var(--bg);
          padding: 20px;
          border-radius: 12px;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
        }

        .review-image {
          max-width: 400px;
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
        }

        .review-image img {
          width: 100%;
          height: auto;
          display: block;
        }

        .no-image {
          padding: 40px;
          text-align: center;
          background: var(--bg);
          border-radius: 12px;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
      `}</style>

      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate(createPageUrl('Reviews'))}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="detail-title">Review Detail</h1>
        <div className="action-buttons">
          {review.status !== 'approved' && (
            <button
              className="btn-action btn-approve"
              onClick={() => updateMutation.mutate({ patch: { status: 'approved' } })}
              disabled={updateMutation.isPending}
            >
              <Check className="w-5 h-5" />
              Approve
            </button>
          )}
          {review.status !== 'rejected' && (
            <button
              className="btn-action btn-reject"
              onClick={() => updateMutation.mutate({ patch: { status: 'rejected' } })}
              disabled={updateMutation.isPending}
            >
              <X className="w-5 h-5" />
              Reject
            </button>
          )}
        </div>
      </div>

      <div className="review-card">
        <div className="review-header">
          <div className="product-name">{review.product?.name || review.product_name || 'Unknown Product'}</div>
          <div className="review-author">
            {review.author_name || review.name || review.reviewer_name}
            <span className={`status-badge status-${review.status}`}>{review.status}</span>
          </div>
          <div className="review-rating">
            {renderStars(review.rating)}
          </div>
          <div className="review-date">
            Submitted {new Date(review.created_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {review.title && (
          <div className="review-title">{review.title}</div>
        )}

        <div className="review-body">{review.body || review.comment}</div>

        <div className="review-image">
          {(review.image_url || (review.images && review.images[0])) ? (
            <img src={review.image_url || review.images[0]} alt="Review" />
          ) : (
            <div className="no-image">
              <ImageIcon className="w-12 h-12" />
              <span>No image provided</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}