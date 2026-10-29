import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { AlertTriangle, Trash2, Search, ChevronDown, Check, X, Loader2, PackageSearch } from 'lucide-react';

const REASONS = ['Rosak dan tidak bernilai dibaiki', 'Usang / Lapuk', 'Hilang / Dicuri', 'Lain-lain'];
const localDate = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export default function AdminDisposal() {
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [reason, setReason] = useState('Usang / Lapuk');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const searchId = useId();
  const dropdownId = useId();
  const searchRef = useRef(null);

  const fetchAvailableAssets = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase.from('ICT_Equipment')
        .select('Equipment_ID, Asset_Code, No_Pendaftaran, Jenama, Jenis, Status, User_Equipment(User_ID, Tarikh_Pulang)')
        .neq('Status', 'Dilupuskan').neq('Status', 'DISPOSED').order('No_Pendaftaran');
      if (error) throw error;
      setAssets(data || []);
    } catch (err) {
      console.error('Gagal memuatkan senarai pelupusan:', err);
      setLoadError('Senarai aset tidak dapat dimuatkan. Sila cuba lagi.');
      toast.error('Gagal memuatkan senarai peralatan.');
    } finally { setIsLoading(false); }
  };
  useEffect(() => { fetchAvailableAssets(); }, []);
  useEffect(() => { if (isOpen) searchRef.current?.focus(); }, [isOpen]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => [asset.No_Pendaftaran, asset.Asset_Code, asset.Jenama, asset.Jenis]
      .some((value) => value?.toLowerCase().includes(q)));
  }, [assets, searchQuery]);

  const handleDispose = async () => {
    if (!selectedAsset) return toast.error('Sila pilih peralatan terlebih dahulu.');
    setIsSaving(true);
    try {
      const today = localDate();
      const previousStatus = selectedAsset.Status || 'Tersedia';
      const activeUser = selectedAsset.User_Equipment?.find((assignment) => !assignment.Tarikh_Pulang);

      const { error: disposalError } = await supabase.from('Equipment_Disposal').insert({
        Equipment_ID: selectedAsset.Equipment_ID, Sebab_Lupus: reason, Tarikh_Lupus: today,
      });
      if (disposalError) throw disposalError;

      if (activeUser) {
        const { error } = await supabase.from('User_Equipment').update({
          Tarikh_Pulang: today, Catatan: `Aset dilupuskan (Sebab: ${reason})`,
        }).eq('Equipment_ID', selectedAsset.Equipment_ID).is('Tarikh_Pulang', null);
        if (error) throw error;
      }

      const { error: statusError } = await supabase.from('ICT_Equipment')
        .update({ Status: 'Dilupuskan' }).eq('Equipment_ID', selectedAsset.Equipment_ID);
      if (statusError) throw statusError;

      const { error: historyError } = await supabase.from('Equipment_History').insert({
        Equipment_ID: selectedAsset.Equipment_ID, User_ID: activeUser?.User_ID || null,
        Tindakan: 'Pelupusan Aset', Status_Lama: previousStatus, Status_Baru: 'Dilupuskan',
        Catatan: `Pelupusan disahkan. Sebab: ${reason}`, Tarikh: new Date().toISOString(),
      });
      if (historyError) throw historyError;

      toast.success('Pelupusan berjaya direkodkan.');
      setSelectedAsset(null); setSearchQuery(''); setReason('Usang / Lapuk'); setConfirmOpen(false);
      await fetchAvailableAssets();
    } catch (err) {
      console.error('Proses pelupusan gagal:', err);
      toast.error(`Proses pelupusan gagal: ${err.message || 'Ralat tidak diketahui'}`);
    } finally { setIsSaving(false); }
  };

  const chooseAsset = (asset) => { setSelectedAsset(asset); setIsOpen(false); setSearchQuery(''); };
  const resetForm = () => { setSelectedAsset(null); setReason('Usang / Lapuk'); setSearchQuery(''); setIsOpen(false); };

  return (
    <main className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      <header>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-100"><Trash2 className="h-5 w-5" aria-hidden="true" /></span>
          <div><p className="text-sm font-semibold text-rose-700">Kawalan inventori</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Pelupusan Peralatan ICT</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Rekodkan aset yang tidak lagi sesuai digunakan. Semak kod dan sebab pelupusan sebelum mengesahkan tindakan.</p></div>
        </div>
      </header>

      {loadError && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-rose-800">{loadError}</p><button type="button" onClick={fetchAvailableAssets} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Cuba lagi</button></div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><PackageSearch className="h-4 w-4" aria-hidden="true" /></span><div><h2 className="text-base font-semibold text-slate-950">Butiran pelupusan</h2><p className="mt-0.5 text-sm text-slate-600">Medan bertanda * wajib dipilih.</p></div></div>

        <div className="space-y-2">
          <label htmlFor={searchId} className="block text-sm font-semibold text-slate-800">Pilih peralatan untuk dilupuskan <span className="text-rose-600">*</span></label>
          <div className="relative">
            <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={dropdownId} onClick={() => setIsOpen((open) => !open)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
              <span className={selectedAsset ? 'font-medium text-slate-900' : 'text-slate-500'}>{selectedAsset ? `${selectedAsset.No_Pendaftaran || selectedAsset.Asset_Code || 'Tiada kod'} — ${selectedAsset.Jenama || ''} ${selectedAsset.Jenis || ''}` : 'Cari dan pilih aset…'}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {isOpen && <div id={dropdownId} role="listbox" aria-label="Senarai aset untuk dilupuskan" className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-100 bg-slate-50 p-3"><label htmlFor={searchId} className="sr-only">Cari aset</label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input ref={searchRef} id={searchId} type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari kod, pendaftaran, jenama atau jenis…" className="min-h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1" /></div></div>
              <div className="max-h-64 overflow-y-auto p-1">
                {isLoading ? <p className="px-3 py-8 text-center text-sm text-slate-500">Memuatkan senarai aset…</p> : filteredAssets.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Tiada aset sepadan ditemui.</p> : filteredAssets.map((asset) => {
                  const selected = selectedAsset?.Equipment_ID === asset.Equipment_ID;
                  return <button key={asset.Equipment_ID} type="button" role="option" aria-selected={selected} onClick={() => chooseAsset(asset)} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${selected ? 'bg-rose-50 text-rose-900' : 'text-slate-800 hover:bg-slate-50'}`}>
                    <span><span className="block text-sm font-semibold">{asset.No_Pendaftaran || asset.Asset_Code || 'Tiada kod'}</span><span className="mt-0.5 block text-xs text-slate-600">{asset.Jenama} {asset.Jenis} · Status: {asset.Status || 'Tidak diketahui'}</span></span>{selected && <Check className="h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />}
                  </button>;
                })}
              </div>
            </div>}
          </div>
          {selectedAsset && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-900">Aset dipilih</p><p className="mt-1 text-slate-700">{selectedAsset.Jenama} {selectedAsset.Jenis}</p><p className="mt-1 font-mono text-xs text-slate-600">{selectedAsset.No_Pendaftaran || selectedAsset.Asset_Code || 'Tiada kod'} · Status: {selectedAsset.Status || 'Tidak diketahui'}</p></div>}
        </div>

        <fieldset className="mt-6 space-y-3"><legend className="mb-3 text-sm font-semibold text-slate-800">Sebab pelupusan <span className="text-rose-600">*</span></legend><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {REASONS.map((option) => <label key={option} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${reason === option ? 'border-rose-300 bg-rose-50/70 text-rose-950 ring-1 ring-rose-200' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}><input type="radio" name="disposal-reason" value={option} checked={reason === option} onChange={() => setReason(option)} className="mt-0.5 h-4 w-4 accent-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2" /><span className="text-sm font-medium leading-5">{option}</span></label>)}
        </div></fieldset>

        <div role="note" className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" /><div><p className="text-sm font-semibold">Tindakan ini tidak boleh dianggap sebagai pemadaman biasa</p><p className="mt-1 text-sm leading-5 text-amber-900">Aset akan ditandakan sebagai <strong>Dilupuskan</strong> dan dikeluarkan daripada inventori aktif. Sahkan kod aset dan sebab sebelum meneruskan.</p></div></div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={resetForm} disabled={isSaving} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-50">Kosongkan pilihan</button><button type="button" onClick={() => setConfirmOpen(true)} disabled={isSaving || !selectedAsset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" /> Semak pelupusan</button></div>
      </section>

      {confirmOpen && selectedAsset && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><section role="alertdialog" aria-modal="true" aria-labelledby="confirm-disposal-title" aria-describedby="confirm-disposal-description" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><AlertTriangle className="h-5 w-5" aria-hidden="true" /></span><button type="button" aria-label="Tutup pengesahan" onClick={() => !isSaving && setConfirmOpen(false)} disabled={isSaving} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" /></button></div>
        <h2 id="confirm-disposal-title" className="mt-4 text-lg font-bold text-slate-950">Sahkan pelupusan aset?</h2><p id="confirm-disposal-description" className="mt-2 text-sm leading-6 text-slate-600">Anda akan melupuskan <strong className="text-slate-900">{selectedAsset.No_Pendaftaran || selectedAsset.Asset_Code || 'aset tanpa kod'}</strong> — {selectedAsset.Jenama} {selectedAsset.Jenis}, atas sebab <strong className="text-slate-900">{reason}</strong>. Pastikan maklumat ini tepat sebelum disahkan.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={isSaving} onClick={() => setConfirmOpen(false)} className="min-h-10 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50">Kembali</button><button type="button" disabled={isSaving} onClick={handleDispose} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{isSaving ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sedang memproses…</> : <><Trash2 className="h-4 w-4" aria-hidden="true" /> Ya, sahkan pelupusan</>}</button></div>
      </section></div>}
    </main>
  );
}
