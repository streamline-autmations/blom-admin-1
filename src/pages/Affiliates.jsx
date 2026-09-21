import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Check, ExternalLink, RotateCcw, Save, Undo2, Users, Wallet } from 'lucide-react';

const money = (cents) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format((cents || 0) / 100);

const dateLabel = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const Badge = ({ status }) => (
  <span className={`aff-badge aff-badge-${status}`}>{status}</span>
);

const Stat = ({ label, value, muted }) => (
  <div className="aff-stat">
    <div className="aff-stat-label">{label}</div>
    <div className={`aff-stat-value${muted ? ' muted' : ''}`}>{value}</div>
  </div>
);

export default function Affiliates() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [edits, setEdits] = useState({});
  const [payoutRef, setPayoutRef] = useState('');

  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['affiliates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('affiliates').select('*').order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ['affiliate-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_commissions')
        .select('id,affiliate_id,order_number,order_kind,base_cents,commission_cents,status,attribution_method,created_at,reversal_reason')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: clicks = [] } = useQuery({
    queryKey: ['affiliate-clicks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('affiliate_clicks').select('affiliate_id,is_unique');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ['affiliate-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_payouts')
        .select('*')
        .order('period_start', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const statsFor = useMemo(() => {
    const map = {};
    for (const affiliate of affiliates) {
      const mine = commissions.filter((c) => c.affiliate_id === affiliate.id);
      const live = mine.filter((c) => c.status !== 'reversed');
      map[affiliate.id] = {
        clicks: clicks.filter((c) => c.affiliate_id === affiliate.id).length,
        uniqueClicks: clicks.filter((c) => c.affiliate_id === affiliate.id && c.is_unique).length,
        orders: live.length,
        sales: live.reduce((sum, c) => sum + c.base_cents, 0),
        commission: live.reduce((sum, c) => sum + c.commission_cents, 0),
        owed: mine.filter((c) => c.status === 'approved' || c.status === 'pending')
                  .reduce((sum, c) => sum + c.commission_cents, 0),
        paid: mine.filter((c) => c.status === 'paid').reduce((sum, c) => sum + c.commission_cents, 0),
      };
    }
    return map;
  }, [affiliates, commissions, clicks]);

  const selected = affiliates.find((a) => a.id === selectedId) || null;
  const selectedCommissions = commissions.filter((c) => c.affiliate_id === selectedId);
  const payableCommissions = selectedCommissions.filter((c) => c.status === 'approved' || c.status === 'pending');
  const payableTotal = payableCommissions.reduce((sum, c) => sum + c.commission_cents, 0);
  const selectedPayouts = payouts.filter((p) => p.affiliate_id === selectedId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['affiliates'] });
    queryClient.invalidateQueries({ queryKey: ['affiliate-commissions'] });
    queryClient.invalidateQueries({ queryKey: ['affiliate-payouts'] });
  };

  const selectAffiliate = (id) => {
    setSelectedId(id === selectedId ? null : id);
    setEdits({});
    setPayoutRef('');
  };

  const setCommissionStatus = useMutation({
    mutationFn: async ({ id, status, reason }) => {
      const patch = { status, reversal_reason: status === 'reversed' ? reason || 'Reversed in admin' : null };
      const { error } = await supabase.from('affiliate_commissions').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const saveAffiliate = useMutation({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('affiliates').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEdits({});
      invalidate();
    },
  });

  // Recording a payout marks exactly the commissions it covers as paid, so the payable
  // figure can never drift from what was actually transferred.
  const recordPayout = useMutation({
    mutationFn: async () => {
      if (payableCommissions.length === 0) throw new Error('Nothing payable.');
      const dates = payableCommissions.map((c) => new Date(c.created_at));
      const { data: payout, error: payoutError } = await supabase
        .from('affiliate_payouts')
        .insert({
          affiliate_id: selectedId,
          period_start: new Date(Math.min(...dates)).toISOString().slice(0, 10),
          period_end: new Date(Math.max(...dates)).toISOString().slice(0, 10),
          commission_count: payableCommissions.length,
          total_cents: payableTotal,
          status: 'paid',
          paid_at: new Date().toISOString(),
          reference: payoutRef || null,
        })
        .select()
        .single();
      if (payoutError) throw payoutError;

      const { error } = await supabase
        .from('affiliate_commissions')
        .update({ status: 'paid', paid_at: new Date().toISOString(), payout_id: payout.id })
        .in('id', payableCommissions.map((c) => c.id));
      if (error) throw error;
    },
    onSuccess: () => {
      setPayoutRef('');
      invalidate();
    },
  });

  return (
    <>
      <style>{`
        .aff-header { margin-bottom: 32px; }
        .aff-title { font-size: 28px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .aff-subtitle { color: var(--text-muted); font-size: 14px; }

        .aff-card { background: var(--card); border-radius: 16px; box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light); margin-bottom: 24px; }
        .aff-card.padded { padding: 24px; }
        .aff-card.flush { overflow: hidden; }
        .aff-section-title { font-size: 18px; font-weight: 700; color: var(--text); margin: 0 0 16px; }
        .aff-detail-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 32px 0 20px; flex-wrap: wrap; }
        .aff-detail-name { font-size: 22px; font-weight: 700; color: var(--text); margin: 0; }
        .aff-link { display: inline-flex; align-items: center; gap: 6px; color: var(--accent); font-size: 14px; font-weight: 600; text-decoration: none; }
        .aff-link:hover { text-decoration: underline; }

        .aff-table-wrap { overflow-x: auto; }
        .aff-table { width: 100%; border-collapse: collapse; min-width: 760px; }
        .aff-table th { text-align: left; padding: 16px 24px; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; background: var(--card); border-bottom: 1px solid var(--border); white-space: nowrap; }
        .aff-table td { padding: 16px 24px; color: var(--text); border-bottom: 1px solid var(--border); font-variant-numeric: tabular-nums; }
        .aff-table tr:last-child td { border-bottom: none; }
        .aff-table tbody tr:hover { background: rgba(110, 193, 255, 0.05); }
        .aff-table tr.clickable { cursor: pointer; }
        .aff-table tr.selected { background: rgba(110, 193, 255, 0.10); }
        .aff-table .num { text-align: right; }
        .aff-table .strong { font-weight: 600; }
        .aff-table .owed { font-weight: 600; color: #ca8a04; }
        .aff-muted { color: var(--text-muted); }
        .aff-small { font-size: 12px; }
        .aff-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
        .aff-empty { padding: 48px 24px; text-align: center; color: var(--text-muted); }

        .aff-badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; text-transform: capitalize; background: rgba(148, 163, 184, 0.15); color: var(--text-muted); }
        .aff-badge-active, .aff-badge-paid { background: #16a34a20; color: #16a34a; }
        .aff-badge-approved { background: #3b82f620; color: #3b82f6; }
        .aff-badge-pending { background: #eab30820; color: #ca8a04; }
        .aff-badge-reversed { background: #dc262620; color: #dc2626; }

        .aff-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px; }
        .aff-stat { background: var(--card); border-radius: 16px; padding: 20px 24px; box-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light); }
        .aff-stat-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .aff-stat-value { font-size: 26px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
        .aff-stat-value.muted { color: var(--text-muted); }

        .aff-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; }
        .aff-field { display: flex; flex-direction: column; gap: 8px; }
        .aff-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .aff-input { height: 42px; padding: 0 14px; border-radius: 8px; border: none; background: var(--card); color: var(--text); font-size: 14px; box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light); outline: none; font-variant-numeric: tabular-nums; }
        .aff-input:focus { box-shadow: inset 3px 3px 6px var(--shadow-dark), inset -3px -3px 6px var(--shadow-light), 0 0 0 2px var(--accent); }
        .aff-input.narrow { width: 140px; }
        .aff-input.wide { width: 240px; }
        .aff-input option { background: var(--card); color: var(--text); }
        .aff-help { margin: 12px 0 0; font-size: 13px; color: var(--text-muted); }

        .aff-btn { height: 42px; padding: 0 20px; border-radius: 8px; border: none; background: var(--accent); color: var(--accent-foreground, #fff); font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: opacity 0.2s; }
        .aff-btn:hover:not(:disabled) { opacity: 0.9; }
        .aff-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .aff-btn-text { padding: 6px 12px; border-radius: 8px; border: none; background: var(--card); font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 2px 2px 4px var(--shadow-dark), -2px -2px 4px var(--shadow-light); transition: transform 0.2s; }
        .aff-btn-text:hover { transform: translateY(-1px); }
        .aff-btn-text.danger { color: #dc2626; }
        .aff-btn-text.restore { color: #3b82f6; }

        .aff-payable-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .aff-payable-value { font-size: 26px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
        .aff-error { margin-top: 12px; font-size: 14px; color: #dc2626; }
        .aff-history { list-style: none; margin: 20px 0 0; padding: 16px 0 0; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
        .aff-history li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px; color: var(--text-muted); }
        .aff-history .amount { font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
        .aff-device { color: #ca8a04; white-space: nowrap; }
      `}</style>

      <div className="aff-header">
        <h1 className="aff-title">Affiliates</h1>
        <p className="aff-subtitle">Referral partners, their attributed sales and the commission owed to them.</p>
      </div>

      <div className="aff-card flush">
        <div className="aff-table-wrap">
          <table className="aff-table">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Rate</th>
                <th className="num">Visitors</th>
                <th className="num">Orders</th>
                <th className="num">Sales</th>
                <th className="num">Commission</th>
                <th className="num">Owed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="aff-empty">Loading affiliates…</td></tr>
              ) : affiliates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="aff-empty">
                    <Users size={28} aria-hidden="true" style={{ marginBottom: 8 }} />
                    <div>No affiliates yet.</div>
                  </td>
                </tr>
              ) : affiliates.map((affiliate) => {
                const stats = statsFor[affiliate.id] || {};
                return (
                  <tr
                    key={affiliate.id}
                    onClick={() => selectAffiliate(affiliate.id)}
                    className={`clickable${affiliate.id === selectedId ? ' selected' : ''}`}
                  >
                    <td>
                      <div className="strong">{affiliate.name}</div>
                      <div className="aff-mono aff-muted">?ref={affiliate.code}</div>
                    </td>
                    <td>{(affiliate.commission_rate * 100).toFixed(0)}%</td>
                    <td className="num">{stats.uniqueClicks ?? 0}</td>
                    <td className="num">{stats.orders ?? 0}</td>
                    <td className="num">{money(stats.sales)}</td>
                    <td className="num strong">{money(stats.commission)}</td>
                    <td className="num owed">{money(stats.owed)}</td>
                    <td><Badge status={affiliate.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <>
          <div className="aff-detail-head">
            <h2 className="aff-detail-name">{selected.name}</h2>
            <a
              className="aff-link"
              href={`https://blom-cosmetics.co.za/?ref=${selected.code}`}
              target="_blank"
              rel="noreferrer"
            >
              Open referral link <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>

          <div className="aff-stats">
            <Stat label="Commission owed" value={money(statsFor[selected.id]?.owed)} />
            <Stat label="Already paid" value={money(statsFor[selected.id]?.paid)} muted />
            <Stat label="Attributed orders" value={statsFor[selected.id]?.orders ?? 0} />
            <Stat label="Total clicks" value={statsFor[selected.id]?.clicks ?? 0} muted />
          </div>

          <div className="aff-card padded">
            <h3 className="aff-section-title">Settings</h3>
            {/* Keyed by partner so the uncontrolled inputs reset when switching partners. */}
            <div className="aff-form" key={selected.id}>
              <label className="aff-field">
                <span className="aff-label">Commission rate (%)</span>
                <input
                  type="number" step="0.5" min="0" max="100"
                  defaultValue={(selected.commission_rate * 100).toFixed(1)}
                  onChange={(e) => setEdits((p) => ({ ...p, commission_rate: Number(e.target.value) / 100 }))}
                  className="aff-input narrow"
                />
              </label>
              <label className="aff-field">
                <span className="aff-label">Attribution window (days)</span>
                <input
                  type="number" min="1" max="365"
                  defaultValue={selected.attribution_days}
                  onChange={(e) => setEdits((p) => ({ ...p, attribution_days: Number(e.target.value) }))}
                  className="aff-input narrow"
                />
              </label>
              <label className="aff-field">
                <span className="aff-label">Status</span>
                <select
                  defaultValue={selected.status}
                  onChange={(e) => setEdits((p) => ({ ...p, status: e.target.value }))}
                  className="aff-input narrow"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <button
                onClick={() => saveAffiliate.mutate({ id: selected.id, patch: { ...edits, updated_at: new Date().toISOString() } })}
                disabled={Object.keys(edits).length === 0 || saveAffiliate.isPending}
                className="aff-btn"
              >
                <Save size={16} aria-hidden="true" />
                Save changes
              </button>
            </div>
            <p className="aff-help">
              Rate and window changes apply to future orders. Commissions already recorded keep the rate they were created with.
            </p>
          </div>

          <div className="aff-card padded">
            <h3 className="aff-section-title">Record a payout</h3>
            <div className="aff-form">
              <div className="aff-field">
                <span className="aff-payable-label">Payable now</span>
                <span className="aff-payable-value">{money(payableTotal)}</span>
                <span className="aff-small aff-muted">{payableCommissions.length} commission(s)</span>
              </div>
              <label className="aff-field">
                <span className="aff-label">Payment reference</span>
                <input
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="EFT reference"
                  className="aff-input wide"
                />
              </label>
              <button
                onClick={() => recordPayout.mutate()}
                disabled={payableCommissions.length === 0 || recordPayout.isPending}
                className="aff-btn"
              >
                <Wallet size={16} aria-hidden="true" />
                Mark {money(payableTotal)} as paid
              </button>
            </div>
            {recordPayout.isError && (
              <p className="aff-error">{recordPayout.error?.message || 'Could not record the payout.'}</p>
            )}
            {selectedPayouts.length > 0 && (
              <ul className="aff-history">
                {selectedPayouts.map((payout) => (
                  <li key={payout.id}>
                    <Check size={16} color="#16a34a" aria-hidden="true" />
                    <span className="amount">{money(payout.total_cents)}</span>
                    <span>paid {dateLabel(payout.paid_at)}</span>
                    {payout.reference && <span>· {payout.reference}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h3 className="aff-section-title">Attributed orders</h3>
          <div className="aff-card flush">
            <div className="aff-table-wrap">
              <table className="aff-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Matched by</th>
                    <th className="num">Qualifying sale</th>
                    <th className="num">Commission</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCommissions.length === 0 ? (
                    <tr><td colSpan={7} className="aff-empty">No attributed orders yet.</td></tr>
                  ) : selectedCommissions.map((commission) => (
                    <tr key={commission.id}>
                      <td className="aff-mono" style={{ whiteSpace: 'nowrap' }}>{commission.order_number}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{dateLabel(commission.created_at)}</td>
                      <td className="aff-muted">
                        {commission.attribution_method === 'ip_match' ? (
                          <span className="aff-device" title="Matched by device fingerprint rather than a cookie — less certain">
                            device match
                          </span>
                        ) : (commission.attribution_method || '—')}
                      </td>
                      <td className="num">{money(commission.base_cents)}</td>
                      <td className="num strong">{money(commission.commission_cents)}</td>
                      <td><Badge status={commission.status} /></td>
                      <td>
                        {commission.status === 'reversed' ? (
                          <button
                            onClick={() => setCommissionStatus.mutate({ id: commission.id, status: 'approved' })}
                            className="aff-btn-text restore"
                          >
                            <Undo2 size={14} aria-hidden="true" /> Restore
                          </button>
                        ) : commission.status === 'paid' ? (
                          <span className="aff-small aff-muted">Paid out</span>
                        ) : (
                          <button
                            onClick={() => setCommissionStatus.mutate({ id: commission.id, status: 'reversed' })}
                            className="aff-btn-text danger"
                          >
                            <RotateCcw size={14} aria-hidden="true" /> Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
