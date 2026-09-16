import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/components/data/api';
import { DollarSign, Plus } from 'lucide-react';
import { moneyZAR } from '../components/formatUtils';
import { useToast } from "@/components/ui/use-toast";

// Helper to get period label
const getPeriodLabel = (days) => {
  if (days === 1) return 'Today';
  if (days === 7) return 'Last 7 Days';
  if (days === 30) return 'Last 30 Days';
  return `Last ${days} Days`;
};

export default function Finance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(30);
  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: 'marketing',
    description: '',
    occurred_on: new Date().toISOString().split('T')[0]
  });

  // Fetch finance stats from Netlify function
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['financeStats', selectedPeriod],
    queryFn: async () => {
      const periodParam = selectedPeriod === 1 ? 'today' : selectedPeriod === 7 ? 'week' : 'month';
      const res = await fetch(`/.netlify/functions/admin-finance-stats?period=${periodParam}`);
      if (!res.ok) throw new Error('Failed to fetch finance stats');
      const json = await res.json();
      return json.data;
    }
  });

  // Mutation to add expense
  const addExpenseMutation = useMutation({
    mutationFn: async (expense) => {
      return await api.createOperatingCost(expense);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['financeStats']);
      setIsAddingExpense(false);
      setNewExpense({
        amount: '',
        category: 'marketing',
        description: '',
        occurred_on: new Date().toISOString().split('T')[0]
      });
      toast({
        title: "Expense added",
        description: "The operating cost has been recorded.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add expense: " + error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmitExpense = (e) => {
    e.preventDefault();
    if (!newExpense.amount || !newExpense.description) return;

    addExpenseMutation.mutate({
      ...newExpense,
      amount: parseFloat(newExpense.amount)
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const stats = statsData || { revenue: 0, cogs: 0, expenses: 0, profit: 0, recentExpenses: [] };
  
  console.log('Finance stats data:', stats); // Debug logging

  return (
    <>
      <style>{`
        .finance-page {
          padding: 16px;
          color: var(--text);
        }

        @media (min-width: 768px) {
          .finance-page {
            padding: 32px;
          }
        }

        .finance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .finance-title {
          font-size: 28px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          position: relative;
          overflow: hidden;
        }

        .stat-card.profit::before {
          background: linear-gradient(90deg, #10b981, #34d399);
        }
        
        .stat-card.revenue::before {
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
        }

        .stat-card.expense::before {
          background: linear-gradient(90deg, #ef4444, #f87171);
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: var(--text-muted);
          font-weight: 500;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          color: var(--text);
        }

        .section-card {
          background: var(--card);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
          margin-bottom: 32px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
        }

        .expense-table {
          width: 100%;
          border-collapse: collapse;
        }

        .expense-table th {
          text-align: left;
          padding: 12px;
          color: var(--text-muted);
          font-weight: 500;
          border-bottom: 1px solid var(--border);
        }

        .expense-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }

        .expense-form {
          background: var(--bg);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          border: 1px solid var(--border);
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        @media (min-width: 768px) {
          .form-grid {
            grid-template-columns: 1fr 1fr 1fr auto;
            align-items: end;
          }
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 6px;
          color: var(--text);
        }

        .form-input {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--card);
          color: var(--text);
        }

        .btn-primary {
          background: var(--accent);
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: opacity 0.2s;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        .btn-secondary {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
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
      `}</style>

      <div className="finance-page">
        <div className="finance-header">
          <h1 className="finance-title">
            <DollarSign className="w-8 h-8" />
            Finance Report
          </h1>
          <button 
            className="btn-primary"
            onClick={() => setIsAddingExpense(!isAddingExpense)}
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        <div className="period-selector">
          {[1, 7, 30].map(days => (
            <button
              key={days}
              className={`period-btn ${selectedPeriod === days ? 'active' : ''}`}
              onClick={() => setSelectedPeriod(days)}
            >
              {getPeriodLabel(days)}
            </button>
          ))}
        </div>

        <div className="stats-grid">
          <div className="stat-card revenue">
            <div className="stat-label">Total Revenue (30d)</div>
            <div className="stat-value">{moneyZAR(stats.revenue)}</div>
          </div>
          
          <div className="stat-card expense">
            <div className="stat-label">COGS (Est.)</div>
            <div className="stat-value">{moneyZAR(stats.cogs)}</div>
          </div>

          <div className="stat-card expense">
            <div className="stat-label">Operating Expenses</div>
            <div className="stat-value">{moneyZAR(stats.expenses)}</div>
          </div>

          <div className="stat-card profit">
            <div className="stat-label">Net Profit</div>
            <div className="stat-value" style={{ color: stats.profit >= 0 ? '#10b981' : '#ef4444' }}>
              {moneyZAR(stats.profit)}
            </div>
          </div>
        </div>

        {isAddingExpense && (
          <div className="expense-form">
            <h3 className="font-bold mb-4">Record New Expense</h3>
            <form onSubmit={handleSubmitExpense}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Facebook Ads"
                    value={newExpense.description}
                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Amount (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={newExpense.amount}
                    onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    className="form-input"
                    value={newExpense.category}
                    onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                  >
                    <option value="marketing">Marketing</option>
                    <option value="software">Software</option>
                    <option value="logistics">Logistics</option>
                    <option value="office">Office</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newExpense.occurred_on}
                    onChange={e => setNewExpense({...newExpense, occurred_on: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setIsAddingExpense(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={addExpenseMutation.isPending}
                >
                  {addExpenseMutation.isPending ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">Recent Expenses</h2>
          </div>
          
          {stats.recentExpenses && stats.recentExpenses.length > 0 ? (
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentExpenses.map((expense, i) => (
                  <tr key={i}>
                    <td>{new Date(expense.occurred_on).toLocaleDateString()}</td>
                    <td>{expense.description}</td>
                    <td>
                      <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 capitalize">
                        {expense.category}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {moneyZAR(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No expenses recorded recently.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
