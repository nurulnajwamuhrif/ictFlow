import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Laptop, MapPin, RefreshCw, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const cachedUserDevices = Object.create(null);
const lastFetchTimestamps = Object.create(null);
const CACHE_TTL = 30_000;

const formatDate = (value) => {
  if (!value) return 'Tidak dinyatakan';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarikh tidak sah';
  return new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

const getStatusPresentation = (status) => {
  const label = (typeof status === 'string' && status.trim() ? status : 'Status tidak diketahui').replace(/_/g, ' ');
  const normalized = label.toLocaleLowerCase('ms-MY');

  if (normalized === 'rosak' || normalized === 'dalam pembaikan') {
    return { label, badge: 'border-amber-200 bg-amber-50 text-amber-800', dot: 'bg-amber-500' };
  }
  if (normalized === 'aktif' || normalized === 'baik') {
    return { label, badge: 'border-emerald-200 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' };
  }
  return { label, badge: 'border-slate-200 bg-slate-50 text-slate-700', dot: 'bg-slate-400' };
};

export default function UserDevices({ userId, onSelectProfile, onReportIssue }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const activeUserIdRef = useRef(userId);

  useEffect(() => {
    const userChanged = activeUserIdRef.current !== userId;
    activeUserIdRef.current = userId;
    if (userChanged) {
      setDevices([]);
      setError('');
      setLoading(true);
    }

    let cancelled = false;

    const loadDevices = async () => {
      if (!userId) {
        setDevices([]);
        setError('Maklumat pengguna tidak tersedia.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const { data, error: queryError } = await supabase
          .from('User_Equipment')
          .select(`
            Tarikh_Diberi,
            Catatan,
            ICT_Equipment (
              Equipment_ID,
              Asset_Code,
              Jenis,
              Jenama,
              No_Siri,
              Lokasi,
              Status,
              Keadaan
            )
          `)
          .eq('User_ID', userId)
          .limit(50);

        if (queryError) throw queryError;
        if (cancelled) return;

        const formatted = (data ?? [])
          .filter((item) => item.ICT_Equipment)
          .map((item) => ({
            ...item.ICT_Equipment,
            assignedDate: item.Tarikh_Diberi,
            assignmentNote: item.Catatan,
          }));

        setDevices(formatted);
      } catch (fetchError) {
        console.error('Failed to load devices:', fetchError);
        if (!cancelled) setError('Senarai aset tidak dapat dimuatkan.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDevices();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshVersion]);

  const refresh = () => setRefreshVersion((v) => v + 1);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Aset Saya</h2>
          <p className="text-xs text-slate-500 mt-0.5">{devices.length} aset ditugaskan kepada profil ruang kerja anda.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-6 bg-slate-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          Tiada item perkakasan ditugaskan di bawah akaun anda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((dev) => {
            const status = getStatusPresentation(dev.Status);
            const assetCode = dev.Asset_Code || `AST-ICT-${dev.Equipment_ID}`;
            const deviceName = [dev.Jenama, dev.Jenis].filter(Boolean).join(' ') || 'Peralatan ICT';

            return (
              <div key={dev.Equipment_ID} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {dev.Jenis || 'ICT'}
                    </span>
                    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${status.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-semibold text-slate-900 text-sm">{deviceName}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Kod Aset: {assetCode}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Nombor Siri</span>
                      <span className="font-mono text-slate-700 font-medium">{dev.No_Siri || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Ditugaskan Sejak</span>
                      <span className="text-slate-700 font-medium">{formatDate(dev.assignedDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => onSelectProfile?.(dev)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Lihat Butiran
                  </button>
                  <button 
                    type="button"
                    onClick={() => onReportIssue?.(dev)}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <AlertCircle className="w-3.5 h-3.5" /> Lapor Isu
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}