import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Check, RotateCcw, Save, Undo2, Users, Wallet } from 'lucide-react';

const money = (cents) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format((cents || 0) / 100);

const dateLabel = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_STYLES = {
  paid: 'bg-emerald-50 text-emerald-700',
  approved: 'bg-sky-50 text-sky-700',
  pending: 'bg-amber-50 text-amber-800',
  reversed: 'bg-rose-50 text-rose-700',
};

const Badge = ({ status }) => (
  <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'}`}>
    {status}
  </span>
);

const Stat = ({ label, value, muted }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-semibold tabular-nums ${muted ? 'text-slate-500' : 'text-slate-900'}`}>{value}</p>
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['affiliates'] });
    queryClient.invalidateQueries({ queryKey: ['affiliate-commissions'] });
    queryClient.invalidateQueries({ queryKey: ['affiliate-payouts'] });
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

  if (isLoading) return <div className="p-6 text-slate-500">Loading affiliates…</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Affiliates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Referral partners, their attributed sales and the commission owed to them.
        </p>
      </div>

      {affiliates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
          <Users className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
          No affiliates yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Partner</th>
                <th className="px-4 py-3 font-medium">Rate</th>
                <th className="px-4 py-3 text-right font-medium">Visitors</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Sales</th>
                <th className="px-4 py-3 text-right font-medium">Commission</th>
                <th className="px-4 py-3 text-right font-medium">Owed</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {affiliates.map((affiliate) => {
                const stats = statsFor[affiliate.id] || {};
                return (
                  <tr
                    key={affiliate.id}
                    onClick={() => setSelectedId(affiliate.id === selectedId ? null : affiliate.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${affiliate.id === selectedId ? 'bg-slate-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{affiliate.name}</div>
                      <div className="font-mono text-xs text-slate-500">?ref={affiliate.code}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{(affiliate.commission_rate * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{stats.uniqueClicks ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{stats.orders ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(stats.sales)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(stats.commission)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-amber-700">{money(stats.owed)}</td>
                    <td className="px-4 py-3"><Badge status={affiliate.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="space-y-6 rounded-lg border border-slate-200 bg-slate-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{selected.name}</h2>
            <a
              className="text-sm text-sky-700 underline"
              href={`https://blom-cosmetics.co.za/?ref=${selected.code}`}
              target="_blank"
              rel="noreferrer"
            >
              Open referral link
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Commission owed" value={money(statsFor[selected.id]?.owed)} />
            <Stat label="Already paid" value={money(statsFor[selected.id]?.paid)} muted />
            <Stat label="Attributed orders" value={statsFor[selected.id]?.orders ?? 0} />
            <Stat label="Total clicks" value={statsFor[selected.id]?.clicks ?? 0} muted />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Settings</h3>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <label className="text-sm">
                <span className="block text-slate-600">Commission rate (%)</span>
                <input
                  type="number" step="0.5" min="0" max="100"
                  defaultValue={(selected.commission_rate * 100).toFixed(1)}
                  onChange={(e) => setEdits((p) => ({ ...p, commission_rate: Number(e.target.value) / 100 }))}
                  className="mt-1 h-10 w-32 rounded border border-slate-300 px-2 tabular-nums"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600">Attribution window (days)</span>
                <input
                  type="number" min="1" max="365"
                  defaultValue={selected.attribution_days}
                  onChange={(e) => setEdits((p) => ({ ...p, attribution_days: Number(e.target.value) }))}
                  className="mt-1 h-10 w-32 rounded border border-slate-300 px-2 tabular-nums"
                />
              </label>
              <label className="text-sm">
                <span className="block text-slate-600">Status</span>
                <select
                  defaultValue={selected.status}
                  onChange={(e) => setEdits((p) => ({ ...p, status: e.target.value }))}
                  className="mt-1 h-10 w-36 rounded border border-slate-300 px-2"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <button
                onClick={() => saveAffiliate.mutate({ id: selected.id, patch: { ...edits, updated_at: new Date().toISOString() } })}
                disabled={Object.keys(edits).length === 0 || saveAffiliate.isPending}
                className="inline-flex h-10 items-center gap-2 rounded bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Save changes
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Rate and window changes apply to future orders. Commissions already recorded keep the rate they were created with.
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Record a payout</h3>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Payable now</p>
                <p className="text-xl font-semibold tabular-nums text-slate-900">{money(payableTotal)}</p>
                <p className="text-xs text-slate-500">{payableCommissions.length} commission(s)</p>
              </div>
              <label className="text-sm">
                <span className="block text-slate-600">Payment reference</span>
                <input
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="EFT reference"
                  className="mt-1 h-10 w-56 rounded border border-slate-300 px-2"
                />
              </label>
              <button
                onClick={() => recordPayout.mutate()}
                disabled={payableCommissions.length === 0 || recordPayout.isPending}
                className="inline-flex h-10 items-center gap-2 rounded bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-40"
              >
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Mark {money(payableTotal)} as paid
              </button>
            </div>
            {recordPayout.isError && (
              <p className="mt-2 text-sm text-rose-700">{recordPayout.error?.message || 'Could not record the payout.'}</p>
            )}
            {payouts.filter((p) => p.affiliate_id === selected.id).length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-slate-600">
                {payouts.filter((p) => p.affiliate_id === selected.id).map((payout) => (
                  <li key={payout.id} className="flex flex-wrap gap-2">
                    <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <span className="tabular-nums font-medium text-slate-900">{money(payout.total_cents)}</span>
                    <span>on {dateLabel(payout.paid_at)}</span>
                    {payout.reference && <span className="text-slate-500">· {payout.reference}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Attributed orders</h3>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-medium">Order</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Matched by</th>
                    <th className="px-4 py-3 text-right font-medium">Qualifying sale</th>
                    <th className="px-4 py-3 text-right font-medium">Commission</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedCommissions.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No attributed orders yet.</td></tr>
                  ) : selectedCommissions.map((commission) => (
                    <tr key={commission.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{commission.order_number}</td>
                      <td className="whitespace-nowrap px-4 py-3">{dateLabel(commission.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {commission.attribution_method === 'ip_match' ? (
                          <span className="text-amber-700" title="Matched by device fingerprint rather than a cookie — less certain">
                            device match
                          </span>
                        ) : (commission.attribution_method || '—')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(commission.base_cents)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{money(commission.commission_cents)}</td>
                      <td className="px-4 py-3"><Badge status={commission.status} /></td>
                      <td className="px-4 py-3">
                        {commission.status === 'reversed' ? (
                          <button
                            onClick={() => setCommissionStatus.mutate({ id: commission.id, status: 'approved' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:underline"
                          >
                            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Restore
                          </button>
                        ) : commission.status === 'paid' ? (
                          <span className="text-xs text-slate-400">Paid out</span>
                        ) : (
                          <button
                            onClick={() => setCommissionStatus.mutate({ id: commission.id, status: 'reversed' })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:underline"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
