import { useState } from "react";
import { api } from "../components/data/api";
import { useMutation } from "@tanstack/react-query";
import { MessageSquare, Send } from "lucide-react";

export default function MessageIntake() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    inquiry_type: "general",
    subject: "",
    body: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data) => api.createMessage(data),
    onSuccess: () => {
      setSubmitted(true);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        inquiry_type: "general",
        subject: "",
        body: ""
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
              <MessageSquare className="w-10 h-10" />
            </div>
            <h1 className="success-title">Message Sent!</h1>
            <p className="success-text">
              Thank you for contacting us. We&apos;ve received your message and will get back to you shortly.
            </p>
            <button className="btn-new" onClick={() => setSubmitted(false)}>
              Send Another Message
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

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
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
              <MessageSquare className="w-8 h-8" />
            </div>
            <h1 className="intake-title">Contact Us</h1>
            <p className="intake-subtitle">Send us a message and we&apos;ll get back to you soon</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+27 XX XXX XXXX"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Inquiry Type</label>
                <select
                  className="form-select"
                  value={formData.inquiry_type}
                  onChange={(e) => setFormData({ ...formData, inquiry_type: e.target.value })}
                >
                  <option value="general">General</option>
                  <option value="order">Order</option>
                  <option value="shipping">Shipping</option>
                  <option value="returns">Returns</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input
                type="text"
                className="form-input"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Message *</label>
              <textarea
                className="form-textarea"
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                required
              />
            </div>

            {createMutation.isError && (
              <div className="error-message">
                {createMutation.error?.message || 'Failed to send message. Please try again.'}
              </div>
            )}

            <button
              type="submit"
              className="btn-submit"
              disabled={createMutation.isPending}
            >
              <Send className="w-5 h-5" />
              {createMutation.isPending ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}