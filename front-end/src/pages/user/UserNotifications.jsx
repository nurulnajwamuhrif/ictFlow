import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

export default function UserNotifications({ userId, onNavigateToReport }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchNotifications = async () => {
      if (!userId) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('Notification')
        .select('*')
        .eq('User_ID', userId)
        .order('Tarikh', { ascending: false });

      if (cancelled) return;

      if (!error && data) {
        setNotifications(data);
      }
      setLoading(false);
    };

    void fetchNotifications();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshVersion]);

  const markAsRead = async (notifId) => {
    await supabase
      .from('Notification')
      .update({ Read_Status: true })
      .eq('Notification_ID', notifId);

    setNotifications((prev) =>
      prev.map((n) => (n.Notification_ID === notifId ? { ...n, Read_Status: true } : n))
    );
  };

  const refresh = () => setRefreshVersion((v) => v + 1);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Log Aktiviti</h2>
          <p className="text-xs text-slate-500 mt-0.5">Garis masa kemaskini mengenai penugasan peralatan dan aduan.</p>
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

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-start gap-3.5 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          Tiada aktiviti terkini atau notis direkodkan.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
          {notifications.map((n) => (
            <div 
              key={n.Notification_ID} 
              onClick={() => markAsRead(n.Notification_ID)}
              className={`p-4 flex items-start gap-3.5 transition cursor-pointer hover:bg-slate-50 ${
                !n.Read_Status ? 'bg-blue-50/40' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-900">{n.Pesan}</p>
                  <span className="text-[10px] text-slate-400">
                    {new Date(n.Tarikh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(n.Tarikh)}</p>

                {n.Report_ID && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToReport?.();
                    }}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Lihat butiran aduan <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}