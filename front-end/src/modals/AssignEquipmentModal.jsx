import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Search, CheckCircle, X } from 'lucide-react';

export default function AssignEquipmentModal({ user, onClose, onSuccess }) {
  const [availableAssets, setAvailableAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [catatan, setCatatan] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAvailableEquipment();
  }, []);

  const fetchAvailableEquipment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ICT_Equipment')
        .select('*')
        .or('Status.eq.Tersedia,Status.eq.Available,Status.is.null')
        .order('Asset_Code');

      if (error) throw error;
      setAvailableAssets(data || []);
    } catch (err) {
      toast.error("Gagal memuatkan inventori: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedAssetId) return toast.error("Sila pilih peralatan terlebih dahulu.");

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Insert new assignment into User_Equipment
      const { error: assignError } = await supabase
        .from('User_Equipment')
        .insert({
          User_ID: user.id,
          Equipment_ID: selectedAssetId,
          Tarikh_Diberi: today,
          Catatan: catatan || 'Agihan baru'
        });

      if (assignError) throw assignError;

      // 2. Update equipment status in ICT_Equipment to 'Dalam Guna'
      const { error: updateError } = await supabase
        .from('ICT_Equipment')
        .update({ Status: 'Dalam Guna' })
        .eq('Equipment_ID', selectedAssetId);

      if (updateError) throw updateError;

      // 3. Log audit entry into Equipment_History[cite: 2]
      const { error: historyError } = await supabase
        .from('Equipment_History')
        .insert({
          Equipment_ID: selectedAssetId,
          User_ID: user.id,
          Tindakan: 'Agihan Aset',
          Status_Lama: 'Tersedia',
          Status_Baru: 'Dalam Guna',
          Catatan: catatan ? `Diagihkan kepada ${user.name}: ${catatan}` : `Diagihkan kepada ${user.name}`,
          Tarikh: new Date().toISOString()
        });

      if (historyError) {
        console.error("Gagal mendaftar rekod sejarah:", historyError.message);
      }

      toast.success("Peralatan berjaya diagihkan!");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Gagal mengagihkan peralatan: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAssets = availableAssets.filter((asset) => {
    const q = searchTerm.toLowerCase();
    return (
      asset.Asset_Code?.toLowerCase().includes(q) ||
      asset.No_Pendaftaran?.toLowerCase().includes(q) ||
      asset.Jenama?.toLowerCase().includes(q) ||
      asset.Jenis?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base text-white">Agih Peralatan ICT</h3>
            <p className="text-xs text-slate-400">Pilih peralatan stok untuk {user.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAssign} className="p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kod aset, no. pendaftaran atau jenama..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pilih Peralatan (Stok Tersedia) *</label>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
              {loading ? (
                <div className="p-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">Tiada peralatan sedia ada ditemui dalam stok.</div>
              ) : (
                filteredAssets.map((asset) => {
                  const isSelected = selectedAssetId === asset.Equipment_ID;
                  return (
                    <div
                      key={asset.Equipment_ID}
                      onClick={() => setSelectedAssetId(asset.Equipment_ID)}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer transition ${
                        isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{asset.No_Pendaftaran || asset.Asset_Code || 'Tiada Kod'} — {asset.Jenama} {asset.Jenis}</p>
                        <p className="text-[10px] text-slate-400 font-normal">Keadaan: {asset.Keadaan || 'Baik'} • Lokasi: {asset.Lokasi || '-'}</p>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan / Urusan</label>
            <input
              type="text"
              placeholder="cth: Kegunaan rasmi di pejabat"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-medium transition cursor-pointer">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedAssetId}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition cursor-pointer shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              {submitting ? "Serah..." : "Sahkan Agihan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}