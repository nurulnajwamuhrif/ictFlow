import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Laptop, Wrench, AlertCircle, ArrowUpRight, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';

const formatStatus = (status = '') => status.replaceAll('_', ' ');

export default function AdminDashboard({ setActiveTab }) {
  const [stats, setStats] = useState({ totalAssets: 0, pendingReports: 0, activeRepairs: 0 });
  const [urgentReports, setUrgentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [assetsRes, reportsCountRes, repairsRes, reportsRes] = await Promise.all([
        supabase.from('ICT_Equipment').select('*', { count: 'exact', head: true }),
        supabase.from('Equipment_Report').select('*', { count: 'exact', head: true }).neq('Status_Laporan', 'Selesai'),
        supabase.from('Equipment_Repair').select('*', { count: 'exact', head: true }).neq('Status_Pembaikan', 'Selesai'),
        supabase.from('Equipment_Report')
          .select('*, ICT_Equipment(Asset_Code)')
          .neq('Status_Laporan', 'Selesai')
          .order('Tarikh_Laporan', { ascending: false })
          .limit(5),
      ]);

      const firstError = assetsRes.error || reportsCountRes.error || repairsRes.error || reportsRes.error;
      if (firstError) throw firstError;

      setStats({
        totalAssets: assetsRes.count || 0,
        pendingReports: reportsCountRes.count || 0,
        activeRepairs: repairsRes.count || 0,
      });
      setUrgentReports(reportsRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Gagal memuatkan dashboard admin:', err);
      setError('Data dashboard tidak dapat dimuatkan. Semak sambungan dan cuba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const statCards = [
    { label: 'Aduan belum selesai', value: stats.pendingReports, icon: AlertCircle, tone: 'rose', desc: 'Memerlukan tindakan susulan' },
    { label: 'Pembaikan aktif', value: stats.activeRepairs, icon: Wrench, tone: 'amber', desc: 'Belum ditandakan selesai' },
    { label: 'Jumlah aset', value: stats.totalAssets, icon: Laptop, tone: 'blue', desc: 'Rekod inventori berdaftar' },
  ];
  const tones = {
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  };

  return (
    <main className="space-y-7 sm:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-700">Pusat operasi ICT</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Pusat Kawalan Admin</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Pantau aduan, pembaikan dan keadaan inventori dalam satu paparan.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <p className="text-xs text-slate-500">Dikemas kini {lastUpdated.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</p>}
          <button type="button" onClick={fetchDashboardData} disabled={loading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Muat semula
          </button>
        </div>
      </header>

      {error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-rose-800">{error}</p>
        <button type="button" onClick={fetchDashboardData} className="self-start rounded-lg px-3 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Cuba lagi</button>
      </div>}

      <section aria-label="Ringkasan sistem" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((item) => {
          const Icon = item.icon;
          return <article key={item.label} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600">{item.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950" aria-live="polite">{loading ? '—' : item.value.toLocaleString('ms-MY')}</p>
                <p className="mt-2 text-sm text-slate-500">{item.desc}</p>
              </div>
              <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[item.tone]}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
            </div>
          </article>;
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><Clock className="h-5 w-5" aria-hidden="true" /></span>
            <div><h2 className="text-base font-semibold text-slate-950 sm:text-lg">Aduan yang memerlukan perhatian</h2><p className="mt-1 text-sm text-slate-600">Lima aduan belum selesai yang paling terkini.</p></div>
          </div>
          <button type="button" onClick={() => setActiveTab('reports')}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:self-auto">
            Semua aduan <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600"><tr>
              <th scope="col" className="px-5 py-3.5 sm:px-6">Kod aset</th><th scope="col" className="px-5 py-3.5 sm:px-6">Masalah</th><th scope="col" className="px-5 py-3.5 sm:px-6">Status</th><th scope="col" className="px-5 py-3.5 text-right sm:px-6">Tindakan</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500"><span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> Memuatkan aduan…</span></td></tr>
                : urgentReports.length === 0 ? <tr><td colSpan={4} className="px-6 py-12 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-slate-800">Tiada aduan tertunda</p><p className="mt-1 text-sm text-slate-500">Semua aduan yang dipaparkan telah selesai.</p></td></tr>
                : urgentReports.map((report) => <tr key={report.Report_ID} className="transition-colors hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-sm font-medium text-slate-700 sm:px-6">{report.ICT_Equipment?.Asset_Code || 'Tiada kod'}</td>
                  <td className="max-w-sm px-5 py-4 sm:px-6"><p className="line-clamp-2 text-sm text-slate-700">{report.Masalah || 'Tiada penerangan'}</p><p className="mt-1 text-xs text-slate-500">Aduan #{report.Report_ID}</p></td>
                  <td className="px-5 py-4 sm:px-6"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${report.Status_Laporan === 'Baru' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'}`}>{formatStatus(report.Status_Laporan || 'Baru')}</span></td>
                  <td className="px-5 py-4 text-right sm:px-6"><button type="button" onClick={() => setActiveTab('reports')} className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Semak</button></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
