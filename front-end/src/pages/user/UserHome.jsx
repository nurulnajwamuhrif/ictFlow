import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Laptop,
  QrCode,
  RefreshCw,
} from 'lucide-react';
// Adjust this import path if your lib folder is located elsewhere (e.g., '../lib/supabase')
import { supabase } from '../../lib/supabase';

const cachedHomeData = Object.create(null);
const lastFetchTimestamps = Object.create(null);
const CACHE_TTL = 30_000;

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

export default function UserHome({ userId, userName, onNavigate, onOpenQR, onOpenComplaint, onOpenProfile }) {
  const [userDevices, setUserDevices] = useState([]);
  const [activeReportsCount, setActiveReportsCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const activeUserIdRef = useRef(userId);

  useEffect(() => {
    const userChanged = activeUserIdRef.current !== userId;
    activeUserIdRef.current = userId;
    if (userChanged) {
      setUserDevices([]);
      setActiveReportsCount(null);
      setError('');
      setLoading(true);
    }

    let cancelled = false;

    const loadWorkspaceData = async () => {
      if (!userId) {
        setUserDevices([]);
        setActiveReportsCount(null);
        setError('Maklumat pengguna tidak tersedia. Sila log masuk semula.');
        setLoading(false);
        return;
      }

      const cached = cachedHomeData[userId];
      const lastFetched = lastFetchTimestamps[userId] || 0;
      if (cached && Date.now() - lastFetched < CACHE_TTL) {
        setUserDevices(cached.devices);
        setActiveReportsCount(cached.activeReportsCount);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [deviceResult, reportResult] = await Promise.all([
          supabase
            .from('User_Equipment')
            .select(`
              Tarikh_Diberi,
              ICT_Equipment (
                Equipment_ID,
                Asset_Code,
                Jenis,
                Jenama,
                No_Siri,
                Status,
                Keadaan
              )
            `)
            .eq('User_ID', userId)
            .limit(50),
          supabase
            .from('Equipment_Report')
            .select('*', { count: 'exact', head: true })
            .eq('User_ID', userId)
            .neq('Status_Laporan', 'Selesai'),
        ]);

        if (cancelled) return;

        const formattedDevices = (deviceResult.data ?? [])
          .filter((item) => item.ICT_Equipment)
          .map((item) => ({ ...item.ICT_Equipment, assignedDate: item.Tarikh_Diberi }));

        setUserDevices(formattedDevices);
        if (!deviceResult.error && !reportResult.error) {
          const reportCount = reportResult.count ?? 0;
          setActiveReportsCount(reportCount);
          cachedHomeData[userId] = {
            devices: formattedDevices,
            activeReportsCount: reportCount,
          };
          lastFetchTimestamps[userId] = Date.now();
          setError('');
        } else {
          if (!reportResult.error) setActiveReportsCount(reportResult.count ?? 0);
          else setActiveReportsCount(null);
          setError('Sebahagian maklumat tidak dapat dimuatkan. Sila cuba semula.');
        }
      } catch (fetchError) {
        console.error('Failed to load workspace data:', fetchError);
        if (!cancelled) setError('Maklumat ruang kerja tidak dapat dimuatkan. Semak sambungan anda dan cuba lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadWorkspaceData();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshVersion]);

  const refresh = () => {
    if (userId) lastFetchTimestamps[userId] = 0;
    setRefreshVersion((v) => v + 1);
  };

  return (
    <section className="space-y-8" aria-labelledby="home-heading">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-700">Ruang kerja ICT</p>
          <h1 id="home-heading" className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Selamat pagi{userName ? `, ${userName}` : ''}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Berikut adalah status peralatan ruang kerja yang ditugaskan kepada anda.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Muat semula
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {activeReportsCount === 0 ? 'Semuanya berjalan seperti biasa' : `${activeReportsCount || 0} isu aktif dalam semakan`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {userDevices.length} aset ditugaskan · {activeReportsCount || 0} aduan aktif
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tindakan Pantas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-blue-300 transition flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-sm text-slate-900">Imbas QR Peralatan</h4>
              <p className="text-xs text-slate-500 mt-1">Halakan kamera pada kod QR untuk membuka butiran atau merekodkan isu.</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenQR?.()}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 px-3 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              Imbas Kod QR <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div className="mt-4">
              <h4 className="font-semibold text-sm text-slate-900">Lapor Masalah</h4>
              <p className="text-xs text-slate-500 mt-1">Pilih daripada peralatan yang ditugaskan untuk memohon sokongan.</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenComplaint?.()}
              className="mt-4 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2.5 px-3 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              Lapor Masalah
            </button>
          </div>
        </div>
      </div>

      {/* Equipment Grid */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Peralatan Anda</h3>
          <button 
            type="button"
            onClick={() => onNavigate?.('assets')} 
            className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Lihat semua ({userDevices.length}) <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse space-y-3">
                <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                <div className="h-5 bg-slate-100 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : userDevices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
            Tiada peralatan ditugaskan kepada akaun anda.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {userDevices.map((device) => {
              const status = getStatusPresentation(device.Status);
              const assetCode = device.Asset_Code || `AST-${device.Equipment_ID}`;
              const deviceName = [device.Jenama, device.Jenis].filter(Boolean).join(' ') || 'Peralatan ICT';

              return (
                <button
                  key={device.Equipment_ID}
                  type="button"
                  onClick={() => onOpenProfile?.(device)}
                  className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-200 hover:shadow-sm transition cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">{assetCode}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${status.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span> {status.label}
                      </span>
                    </div>
                    <h4 className="font-semibold text-xs text-slate-900 line-clamp-1">{deviceName}</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">S/N: {device.No_Siri || 'N/A'}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 text-right">
                    <span className="text-[11px] font-medium text-blue-600">Lihat butiran →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}