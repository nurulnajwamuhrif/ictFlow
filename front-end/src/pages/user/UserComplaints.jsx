import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const formatDate = (value) => {
  if (!value) return 'Tarikh tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarikh tidak sah';
  return new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

const formatStatus = (status) => (status || 'Baru').replace(/_/g, ' ');

const getStageStep = (status) => {
  switch (status) {
    case 'Baru': return 1;
    case 'Dalam_Siasatan': return 2;
    case 'Dalam_Pembaikan': return 3;
    case 'Selesai': return 4;
    default: return 1;
  }
};

export default function UserComplaints({ userId }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchComplaints = async () => {
      if (!userId) {
        setComplaints([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('Equipment_Report')
        .select('*, ICT_Equipment(Equipment_ID, Jenis, Jenama, No_Siri)')
        .eq('User_ID', userId)
        .order('Tarikh_Laporan', { ascending: false });

      if (cancelled) return;

      if (!queryError && data) {
        setComplaints(data);
      } else {
        setError('Aduan tidak dapat dimuatkan.');
      }
      setLoading(false);
    };

    void fetchComplaints();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshVersion]);

  const refresh = () => setRefreshVersion((v) => v + 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Aduan Saya</h2>
          <p className="text-xs text-slate-500 mt-0.5">Jejak dan semak isu teknikal yang dilaporkan kepada Sokongan ICT.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Muat semula
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-6 bg-slate-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          Tiada aduan aktif atau lampau dijumpai.
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((ticket) => {
            const step = getStageStep(ticket.Status_Laporan);
            const equipmentName = [ticket.ICT_Equipment?.Jenama, ticket.ICT_Equipment?.Jenis].filter(Boolean).join(' ') || 'Peralatan ICT';

            return (
              <div key={ticket.Report_ID} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-mono font-semibold text-slate-500">#ADU-00{ticket.Report_ID}</span>
                  <span className="text-xs text-slate-400">{formatDate(ticket.Tarikh_Laporan)}</span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{equipmentName}</h4>
                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {ticket.Masalah}
                  </p>
                </div>

                {/* Progress Tracker */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                    <span className={step >= 1 ? 'text-blue-600 font-bold' : ''}>Dilapor</span>
                    <span className={step >= 2 ? 'text-blue-600 font-bold' : ''}>Semakan</span>
                    <span className={step >= 3 ? 'text-blue-600 font-bold' : ''}>Pembaikan</span>
                    <span className={step >= 4 ? 'text-emerald-600 font-bold' : ''}>Selesai</span>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${(step / 4) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Status Semasa:</span>
                  <span className="font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                    ● {formatStatus(ticket.Status_Laporan)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}