import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useEquipment } from '../hooks/useEquipment';

export default function ComplaintModal({ asset, onClose, onSuccess }) {
  const { user } = useAuth();
  const { devices, submitComplaint } = useEquipment();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState(asset?.Equipment_ID || '');
  const [masalah, setMasalah] = useState('');
  const [kategori, setKategori] = useState('Hardware');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEquipmentId || !masalah.trim()) {
      setErrorMsg('Sila pilih peranti dan isi keterangan masalah.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      await submitComplaint({
        equipmentId: parseInt(selectedEquipmentId),
        userId: user?.id || 1,
        masalah,
        kategori
      });
      onSuccess('Aduan kerosakan berjaya dihantar!');
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Ralat semasa menghantar aduan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col justify-end md:justify-center md:items-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] md:rounded-3xl p-6 space-y-4 border border-slate-100 shadow-2xl w-full md:max-w-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Borang Aduan Kerosakan
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!asset && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Peranti *</label>
              <select 
                value={selectedEquipmentId} 
                onChange={(e) => setSelectedEquipmentId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              >
                <option value="">-- Pilih Peranti --</option>
                {devices.map(d => (
                  <option key={d.Equipment_ID} value={d.Equipment_ID}>
                    {d.Jenama} {d.Jenis} ({d.No_Siri || d.Asset_Code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Masalah *</label>
            <select 
              value={kategori} 
              onChange={(e) => setKategori(e.target.value)} 
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            >
              <option value="Hardware">Hardware (Kipas, Skrin, Papan Kekunci)</option>
              <option value="Software">Software (Sistem Pengoperasian, Aplikasi)</option>
              <option value="Network">Rangkaian / Internet</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan Masalah *</label>
            <textarea 
              rows={3} 
              value={masalah} 
              onChange={(e) => setMasalah(e.target.value)} 
              placeholder="Terangkan kerosakan atau isu yang dihadapi..." 
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" 
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={submitting} 
              className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Menghantar...' : 'Hantar Aduan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}