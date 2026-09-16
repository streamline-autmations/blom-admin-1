import { useState } from "react";
import { api } from "../components/data/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Star, Send } from "lucide-react";

export default function ReviewIntake() {
  const [formData, setFormData] = useState({
    product_id: "",
    author_name: "",
    rating: 5,
    title: "",
    body: "",
    image_url: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.listProducts(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const product = products.find(p => p.id === data.product_id);
      return api.createReview({
        ...data,
        product_name: product?.name || 'Unknown Product'
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      setFormData({
        product_id: "",
        author_name: "",
        rating: 5,
        title: "",
        body: "",
        image_url: ""
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <>
        <style>{`
          .intake-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: var(--bg);
          }

          .success-card {
            max-width: 500px;
            width: 100%;
            background: var(--card);
            border-radius: 20px;
            padding: 48px;
            text-align: center;
            box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
          }

          .success-icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            margin: 0 auto 24px;
          }

          .success-title {
            font-size: 28px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 12px;
          }

          .success-text {
            font-size: 16px;
            color: var(--text-muted);
            line-height: 1.6;
            margin-bottom: 32px;
          }

          .btn-new {
            padding: 14px 32px;
            border-radius: 12px;
            border: none;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            color: white;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          }

          .btn-new:hover {
            transform: translateY(-2px);
          }
        `}</style>

        <div className="intake-container">
          <div className="success-card">
            <div className="success-icon">
              <Star className="w-10 h-10" fill="white" />
            </div>
            <h1 className="success-title">Review Submitted!</h1>
            <p className="success-text">
              Thank you for your feedback! Your review has been submitted for moderation and will be published once approved.
            </p>
            <button className="btn-new" onClick={() => setSubmitted(false)}>
              Submit Another Review
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .intake-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--bg);
        }

        .intake-card {
          max-width: 600px;
          width: 100%;
          background: var(--card);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
        }

        .intake-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .intake-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin: 0 auto 16px;
        }

        .intake-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 8px;
        }

        .intake-subtitle {
          font-size: 14px;
          color: var(--text-muted);
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .form-input, .form-textarea, .form-select {
          width: 100%;
          padding: 14px 18px;
          border-radius: 12px;
          border: none;
          background: var(--bg);
          color: var(--text);
          font-size: 15px;
          font-family: inherit;
          box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light);
        }

        .form-input:focus, .form-textarea:focus, .form-select:focus {
          outline: none;
        }

        .form-textarea {
          min-height: 120px;
          resize: vertical;
        }

        .rating-selector {
          display: flex;
          gap: 12px;
          padding: 14px 0;
        }

        .rating-star {
          width: 40px;
          height: 40px;
          border: none;
          background: none;
          cursor: pointer;
          padding: 0;
          transition: transform 0.2s;
        }

        .rating-star:hover {
          transform: scale(1.2);
        }

        .btn-submit {
          width: 100%;
          padding: 14px 32px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
          margin-top: 32px;
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-submit:not(:disabled):hover {
          transform: translateY(-2px);
        }

        .error-message {
          color: #ef4444;
          font-size: 14px;
          margin-top: 16px;
          text-align: center;
        }
      `}</style>

      <div className="intake-container">
        <div className="intake-card">
          <div className="intake-header">
            <div className="intake-icon">
              <Star className="w-8 h-8" fill="white" />
            </div>
            <h1 className="intake-title">Write a Review</h1>
            <p className="intake-subtitle">Share your experience with this product</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Product *</label>
              <select
                className="form-select"
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                required
              >
                <option value="">Select a product</option>
                {products.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Your Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.author_name}
                onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Rating *</label>
              <div className="rating-selector">
                {[1, 2, 3, 4, 5].map(i => (
                  <button
                    key={i}
                    type="button"
                    className="rating-star"
                    onClick={() => setFormData({ ...formData, rating: i })}
                  >
                    <Star
                      className="w-10 h-10"
                      fill={i <= formData.rating ? '#f59e0b' : 'none'}
                      stroke={i <= formData.rating ? '#f59e0b' : 'var(--text-muted)'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Review Title</label>
              <input
                type="text"
                className="form-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Sum up your experience"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Your Review *</label>
              <textarea
                className="form-textarea"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                required
                placeholder="Tell us what you think..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Image URL (optional)</label>
              <input
                type="url"
                className="form-input"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            {createMutation.isError && (
              <div className="error-message">
                {createMutation.error?.message || 'Failed to submit review. Please try again.'}
              </div>
            )}

            <button
              type="submit"
              className="btn-submit"
              disabled={createMutation.isPending}
            >
              <Send className="w-5 h-5" />
              {createMutation.isPending ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}