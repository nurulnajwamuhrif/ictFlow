import React, { useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function DisposalModal({ equipmentId, onClose, onSuccess }) {
  const [sebabLupus, setSebabLupus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sebabLupus.trim()) {
      setErrorMsg('Sila masukkan justifikasi teknikal pelupusan.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('Equipment_Disposal')
        .insert([
          {
            Equipment_ID: equipmentId,
            Sebab_Lupus: sebabLupus,
            Status: 'Dalam_Proses'
          }
        ]);

      if (error) throw error;

      toast.success("Syor pelupusan berjaya dihantar!");
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Ralat semasa menghantar syor pelupusan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col justify-end p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] p-6 space-y-4 border border-slate-100 shadow-2xl max-w-md mx-auto w-full">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <h3 className="font-extrabold text-rose-900 text-base">Syor Pelupusan Aset</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Syor pelupusan hanya dihantar sekiranya item tidak boleh dibaiki atau kos pembaikan melebihi nilai semasa aset. Permohonan akan disemak oleh Pentadbir ICT.
        </p>

        {errorMsg && (
          <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-100">
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Justifikasi Teknikal *</label>
            <textarea 
              rows={3} 
              value={sebabLupus}
              onChange={(e) => setSebabLupus(e.target.value)}
              placeholder="Terangkan dapatan kerosakan kekal..." 
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-rose-500 transition"
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
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
              className="flex-1 py-3.5 rounded-2xl bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-200 hover:bg-rose-700 transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Menghantar Syor...' : 'Hantar Syor Kepada Pentadbir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}