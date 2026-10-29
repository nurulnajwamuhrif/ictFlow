import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Clock, Laptop, User, Wrench, ShieldAlert, Trash2, History } from 'lucide-react';

export default function AssetProfileModal({ equipmentId, onClose }) {
  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (equipmentId) fetchAssetFullDetail();
  }, [equipmentId]);

  const fetchAssetFullDetail = async () => {
    setLoading(true);
    try {
      // 1. Fetch main equipment details & current user
      const { data: assetData, error: assetErr } = await supabase
        .from('ICT_Equipment')
        .select(`*, User_Equipment(Tarikh_Diberi, Tarikh_Pulang, users(name, email))`)
        .eq('Equipment_ID', equipmentId)
        .single();

      if (assetErr) throw assetErr;
      setAsset(assetData);

      // 2. Fetch full timeline logs from Equipment_History
      const { data: historyData } = await supabase
        .from('Equipment_History')
        .select(`*, users(name)`)
        .eq('Equipment_ID', equipmentId)
        .order('Tarikh', { ascending: false });

      setHistory(historyData || []);

      // 3. Fetch repair records
      const { data: repairData } = await supabase
        .from('Equipment_Repair')
        .select('*')
        .eq('Equipment_ID', equipmentId)
        .order('Tarikh_Hantar', { ascending: false });

      setRepairs(repairData || []);

      // 4. Fetch complaint reports
      const { data: reportData } = await supabase
        .from('Equipment_Report')
        .select(`*, users(name)`)
        .eq('Equipment_ID', equipmentId)
        .order('Tarikh_Laporan', { ascending: false });

      setReports(reportData || []);

    } catch (err) {
      console.error("Gagal memuatkan perincian aset:", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!equipmentId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-500/30 rounded-2xl text-blue-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Profil & Sejarah Aset</h3>
              <p className="text-xs text-slate-400">{asset?.No_Pendaftaran || 'Memuatkan...'} • SN: {asset?.No_Siri || '-'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-6 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-4 bg-slate-300 rounded w-3/4"></div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-16 bg-slate-100 rounded-xl"></div>
              <div className="h-16 bg-slate-100 rounded-xl"></div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            
            {/* OVERVIEW SUMMARY GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Peralatan</span>
                <p className="text-xs font-bold text-slate-800">{asset.Jenama} {asset.Jenis}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Lokasi</span>
                <p className="text-xs font-bold text-slate-800">{asset.Lokasi || '-'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                <p className="text-xs font-bold text-blue-600">{asset.Status || 'Tersedia'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Keadaan</span>
                <p className="text-xs font-bold text-slate-800">{asset.Keadaan || 'Baik'}</p>
              </div>
            </div>

            {/* AUDIT LOG TIMELINE */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Kronologi / Sejarah Aset</h4>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Tiada rekod sejarah ditemui.</p>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {history.map((log) => (
                    <div key={log.History_ID} className="relative flex items-start justify-between bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
                      <span className="absolute -left-6 top-3.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{log.Tindakan}</span>
                          {log.Status_Baru && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-full">
                              {log.Status_Lama ? `${log.Status_Lama} → ${log.Status_Baru}` : log.Status_Baru}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600">{log.Catatan || 'Tiada catatan'}</p>
                        {log.users?.name && (
                          <p className="text-[10px] text-slate-400">Oleh / Kepada: {log.users.name}</p>
                        )}
                      </div>

                      <div className="text-right text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(log.Tarikh).toLocaleDateString('en-GB')}<br />
                        {new Date(log.Tarikh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
          <button onClick={onClose} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition">
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}