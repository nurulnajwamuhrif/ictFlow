import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { Wrench, DollarSign, X, Save, Clock, CheckCircle2 } from 'lucide-react';

// --- MODULE-LEVEL CACHE (Lives outside component to persist across tab switches) ---
let cachedRepairsData = null;
let lastFetchTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds cache duration

export default function AdminRepairs() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    Repair_ID: '',
    Equipment_ID: '',
    Tindakan: '',
    Kos: '',
    Status_Pembaikan: 'Dalam Pembaikan'
  });

  useEffect(() => {
    fetchRepairs();
  }, []);

  const fetchRepairs = async (forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache if valid and not forced
    if (!forceRefresh && cachedRepairsData && (now - lastFetchTimestamp < CACHE_TTL)) {
      setRepairs(cachedRepairsData);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Equipment_Repair')
        .select(`
          *, 
          ICT_Equipment(Equipment_ID, Asset_Code, No_Pendaftaran, Jenama, Jenis, Status, User_Equipment(User_ID, Tarikh_Pulang)), 
          Equipment_Report(Masalah, Report_ID)
        `)
        .order('Tarikh_Hantar', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      cachedRepairsData = data || [];
      lastFetchTimestamp = Date.now();
      setRepairs(cachedRepairsData);
    } catch (err) {
      toast.error("Gagal memuatkan rekod pembaikan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRepair = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const isFinishingNow = formData.Status_Pembaikan === 'Selesai';

      // 1. Update Equipment_Repair record
      const updateData = { 
        Tindakan: formData.Tindakan,
        Kos: formData.Kos ? parseFloat(formData.Kos) : 0,
        Status_Pembaikan: formData.Status_Pembaikan
      };

      if (isFinishingNow) {
        updateData.Tarikh_Siap = today;
      }

      const { error: repairErr } = await supabase
        .from('Equipment_Repair')
        .update(updateData)
        .eq('Repair_ID', formData.Repair_ID);

      if (repairErr) throw repairErr;

      // 2. If repair marked as 'Selesai', restore Equipment status
      if (isFinishingNow && formData.Equipment_ID) {
        // Check if there's an assigned active user
        const activeAssignment = formData.activeUser;
        const restoredStatus = activeAssignment ? 'Dalam Guna' : 'Tersedia';

        await supabase
          .from('ICT_Equipment')
          .update({ Status: restoredStatus })
          .eq('Equipment_ID', formData.Equipment_ID);

        // Log into Equipment_History
        await supabase
          .from('Equipment_History')
          .insert({
            Equipment_ID: formData.Equipment_ID,
            User_ID: activeAssignment?.User_ID || null,
            Tindakan: 'Pembaikan Selesai',
            Status_Lama: 'Dalam Pembaikan',
            Status_Baru: restoredStatus,
            Catatan: `Pembaikan selesai. Tindakan: ${formData.Tindakan || 'Tiada catatan'} (Kos: RM ${formData.Kos || '0.00'})`,
            Tarikh: new Date().toISOString()
          });
      } else if (formData.Equipment_ID) {
        // Log general repair update
        await supabase
          .from('Equipment_History')
          .insert({
            Equipment_ID: formData.Equipment_ID,
            Tindakan: 'Kemaskini Pembaikan',
            Status_Lama: 'Dalam Pembaikan',
            Status_Baru: 'Dalam Pembaikan',
            Catatan: `Kemaskini kos/tindakan bengkel: RM ${formData.Kos || '0.00'} - ${formData.Tindakan || 'Tiada'}`,
            Tarikh: new Date().toISOString()
          });
      }

      toast.success("Rekod pembaikan dan sejarah berjaya dikemaskini!");
      setShowEditModal(false);
      cachedRepairsData = null; // Invalidate cache on mutation
      fetchRepairs(true);
    } catch (err) {
      toast.error("Gagal mengemaskini: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (repair) => {
    const activeUser = repair.ICT_Equipment?.User_Equipment?.find(ue => !ue.Tarikh_Pulang);

    setFormData({
      Repair_ID: repair.Repair_ID,
      Equipment_ID: repair.Equipment_ID,
      Tindakan: repair.Tindakan || '',
      Kos: repair.Kos || '',
      Status_Pembaikan: repair.Status_Pembaikan || 'Dalam Pembaikan',
      activeUser: activeUser
    });
    setShowEditModal(true);
  };

  const totalCost = repairs.reduce((acc, curr) => acc + (parseFloat(curr.Kos) || 0), 0);

  return (
    <div className="space-y-6">
      {/* HEADER & SUMMARY CARD */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pengurusan Pembaikan</h2>
          <p className="text-sm text-slate-600 mt-1">Jejak perkakasan di bengkel pembaikan dan kos penyelenggaraan</p>
        </div>

        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-slate-400">Kos 50 Rekod Terkini</div>
            <div className="text-base font-extrabold text-slate-900">RM {totalCost.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-6 bg-slate-100 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : repairs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Tiada rekod pembaikan aktif. Pembaikan baru akan terhasil secara automatik apabila aduan dihantar ke pembaikan.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Peralatan</th>
                <th className="px-6 py-3.5">Aduan / Masalah</th>
                <th className="px-6 py-3.5">Status Pembaikan</th>
                <th className="px-6 py-3.5">Kos (RM)</th>
                <th className="px-6 py-3.5">Tarikh Hantar</th>
                <th className="px-6 py-3.5 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {repairs.map((repair) => {
                const isFinished = repair.Status_Pembaikan === 'Selesai';
                const eq = repair.ICT_Equipment;

                return (
                  <tr key={repair.Repair_ID} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {eq ? `${eq.Jenama} ${eq.Jenis}` : 'Peralatan Tidak Diketahui'}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        {eq?.No_Pendaftaran || eq?.Asset_Code || 'Tiada Kod'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                      {repair.Equipment_Report?.Masalah || repair.Masalah || "Tiada deskripsi"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isFinished ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isFinished ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {isFinished ? 'Selesai' : 'Dalam Pembaikan'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      RM {repair.Kos ? parseFloat(repair.Kos).toFixed(2) : '0.00'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {repair.Tarikh_Hantar ? new Date(repair.Tarikh_Hantar).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => openEditModal(repair)} 
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                       type="button">
                        Kemaskini Kos & Status
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* UPDATE REPAIR COST & ACTION MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Dialog pentadbiran">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Kemaskini Pembaikan</h3>
                  <p className="text-xs text-slate-400">Masukkan kos, tindakan, dan status pembaikan</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500" type="button" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRepair} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Pembaikan *</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                  value={formData.Status_Pembaikan}
                  onChange={e => setFormData({ ...formData, Status_Pembaikan: e.target.value })}
                >
                  <option value="Dalam Pembaikan">Dalam Pembaikan (Di Bengkel)</option>
                  <option value="Selesai">Selesai (Kembalikan ke Operasi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kos Pembaikan (RM)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition" 
                  value={formData.Kos} 
                  onChange={e => setFormData({...formData, Kos: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Tindakan Pembaikan</label>
                <textarea 
                  rows={3}
                  placeholder="Contoh: Tukar papan induk, format semula..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition" 
                  value={formData.Tindakan} 
                  onChange={e => setFormData({...formData, Tindakan: e.target.value})} 
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer shadow-lg shadow-blue-200 flex items-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  <Save className="w-4 h-4" /> {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}