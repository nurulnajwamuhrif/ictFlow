import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Filter, Laptop, Calendar, User, MapPin, Tag, Check, ChevronDown, X, Edit3, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AssetProfileModal from '../../modals/AssetProfileModal';

// --- MODULE-LEVEL CACHE (Lives outside component to persist across tab switches) ---
let cachedEquipmentData = null;
let lastFetchTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds cache duration

// --- ACCESSIBLE REUSABLE SEARCHABLE SELECT ---
function SearchableSelect({ label, options, value, onChange, placeholder, allowCustom = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const inputId = React.useId();
  const listId = React.useId();

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedOptions = options.map((opt) => typeof opt === 'string' ? { label: opt, value: opt } : opt);
  const filteredOptions = normalizedOptions.filter((opt) => (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const selectedLabel = normalizedOptions.find((opt) => opt.value === value)?.label || value;
  const addCustom = allowCustom && searchTerm.trim() && !filteredOptions.some((opt) => opt.label.toLowerCase() === searchTerm.trim().toLowerCase());

  return (
    <div className="relative min-w-0" ref={wrapperRef}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <button type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-controls={listId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        <span className={value ? 'truncate font-medium text-slate-900' : 'truncate text-slate-500'}>{selectedLabel || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {isOpen && <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 bg-slate-50 p-2.5"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input id={inputId} type="search" autoFocus aria-label={`Cari pilihan untuk ${label}`} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1" placeholder="Taip untuk mencari…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
        <div id={listId} role="listbox" aria-label={label} className="max-h-56 overflow-y-auto p-1">
          {addCustom && <button type="button" role="option" aria-selected="false" onClick={() => { onChange(searchTerm.trim()); setIsOpen(false); setSearchTerm(''); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Plus className="h-4 w-4" aria-hidden="true" /> Tambah “{searchTerm.trim()}”</button>}
          {filteredOptions.length === 0 && !addCustom ? <p className="px-3 py-6 text-center text-sm text-slate-500">Tiada pilihan sepadan.</p> : filteredOptions.map((opt, idx) => <button key={`${opt.value}-${idx}`} type="button" role="option" aria-selected={value === opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); setSearchTerm(''); }} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${value === opt.value ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-700 hover:bg-slate-50'}`}><span>{opt.label}</span>{value === opt.value && <Check className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />}</button>)}
        </div>
      </div>}
    </div>
  );
}

export default function AdminEquipment() {
  const [assets, setAssets] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search Debounce State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filters State
  const [filters, setFilters] = useState({
    jenis: 'All',
    status: 'All',
    lokasi: 'All',
    hakMilik: 'All',
    dateStart: '',
    dateEnd: ''
  });

  // PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [viewingAssetId, setViewingAssetId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [newAsset, setNewAsset] = useState({
    Asset_Code: '',
    No_Pendaftaran: '',
    Jenama: '',
    Jenis: '',
    No_Siri: '',
    Lokasi: '',
    Hak_Milik: 'Kerajaan',
    Keadaan: 'Baik',
    Tahun_Perolehan: new Date().toISOString().split('T')[0],
    Assigned_User_ID: ''
  });

  // Debounce Search Handler
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset to page 1 whenever filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filters]);

  useEffect(() => {
    fetchAssets();
    fetchUsers();
  }, []);

  const fetchAssets = async (forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache if valid and not forced
    if (!forceRefresh && cachedEquipmentData && (now - lastFetchTimestamp < CACHE_TTL)) {
      setAssets(cachedEquipmentData);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ICT_Equipment')
        .select(`
          Equipment_ID,
          Asset_Code,
          No_Pendaftaran,
          No_Siri,
          Jenama,
          Jenis,
          Lokasi,
          Status,
          Hak_Milik,
          Keadaan,
          Tahun_Perolehan,
          User_Equipment (
            User_ID,
            Tarikh_Pulang,
            users (
              id,
              name
            )
          )
        `)
        .order('Equipment_ID', { ascending: false });

      if (error) throw error;

      cachedEquipmentData = data || [];
      lastFetchTimestamp = Date.now();
      setAssets(cachedEquipmentData);
    } catch (err) {
      toast.error("Gagal memuatkan data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('userstatus', 'active');

      if (error) throw error;
      setUsersList(data || []);
    } catch (err) {
      console.error("Gagal memuatkan senarai pengguna:", err.message);
    }
  };

  const jenisOptions = [...new Set(assets.map(a => a.Jenis).filter(Boolean))];
  const lokasiOptions = [...new Set(assets.map(a => a.Lokasi).filter(Boolean))];

  // Audit Logging Helper
  const logHistory = async (equipmentId, userId, tindakan, statusLama, statusBaru, catatan) => {
    try {
      await supabase.from('Equipment_History').insert([{
        Equipment_ID: equipmentId,
        User_ID: userId || null,
        Tindakan: tindakan,
        Status_Lama: statusLama || null,
        Status_Baru: statusBaru || null,
        Catatan: catatan,
        Tarikh: new Date().toISOString()
      }]);
    } catch (err) {
      console.error("Gagal log sejarah aset:", err.message);
    }
  };

  // --- ADD ASSET ---
  const handleAddAsset = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const trimmedPendaftaran = newAsset.No_Pendaftaran.trim();
      const trimmedNoSiri = newAsset.No_Siri.trim();

      const { data: existingData, error: checkError } = await supabase
        .from('ICT_Equipment')
        .select('No_Pendaftaran, No_Siri')
        .or(`No_Pendaftaran.ilike.${trimmedPendaftaran},No_Siri.ilike.${trimmedNoSiri}`);

      if (checkError) throw checkError;

      if (existingData && existingData.length > 0) {
        const isPendaftaranDup = existingData.some(
          item => item.No_Pendaftaran?.toLowerCase() === trimmedPendaftaran.toLowerCase()
        );
        const isNoSiriDup = existingData.some(
          item => item.No_Siri?.toLowerCase() === trimmedNoSiri.toLowerCase()
        );

        if (isPendaftaranDup && isNoSiriDup) {
          toast.error("Ralat: No. Pendaftaran dan No. Siri ini telah wujud dalam sistem!");
        } else if (isPendaftaranDup) {
          toast.error("Ralat: No. Pendaftaran ini telah wujud!");
        } else if (isNoSiriDup) {
          toast.error("Ralat: No. Siri ini telah wujud!");
        }
        setSubmitting(false);
        return;
      }

      const initialStatus = newAsset.Assigned_User_ID ? 'Dalam Guna' : 'Tersedia';

      const equipmentData = {
        Asset_Code: newAsset.Asset_Code || trimmedPendaftaran,
        No_Pendaftaran: trimmedPendaftaran,
        Jenama: newAsset.Jenama,
        Jenis: newAsset.Jenis,
        No_Siri: trimmedNoSiri,
        Lokasi: newAsset.Lokasi,
        Status: initialStatus,
        Hak_Milik: newAsset.Hak_Milik,
        Keadaan: newAsset.Keadaan,
        Tahun_Perolehan: newAsset.Tahun_Perolehan
      };

      const { data: insertedEquipment, error: equipmentError } = await supabase
        .from('ICT_Equipment')
        .insert([equipmentData])
        .select();

      if (equipmentError) throw equipmentError;

      const newEquipmentId = insertedEquipment[0].Equipment_ID;

      if (newAsset.Assigned_User_ID && newEquipmentId) {
        const userEquipmentData = {
          User_ID: newAsset.Assigned_User_ID,
          Equipment_ID: newEquipmentId,
          Tarikh_Diberi: new Date().toISOString().split('T')[0],
          Catatan: 'Tugasan awal semasa pendaftaran aset'
        };

        const { error: linkError } = await supabase
          .from('User_Equipment')
          .insert([userEquipmentData]);

        if (linkError) throw linkError;
      }

      await logHistory(
        newEquipmentId,
        newAsset.Assigned_User_ID || null,
        'Pendaftaran Aset',
        null,
        initialStatus,
        'Aset baru didaftarkan ke dalam sistem'
      );

      toast.success("Aset dan pengguna berjaya didaftarkan!");
      setShowAddModal(false);

      setNewAsset({
        Asset_Code: '',
        No_Pendaftaran: '',
        Jenama: '',
        Jenis: '',
        No_Siri: '',
        Lokasi: '',
        Hak_Milik: 'Kerajaan',
        Keadaan: 'Baik',
        Tahun_Perolehan: new Date().toISOString().split('T')[0],
        Assigned_User_ID: ''
      });

      cachedEquipmentData = null; // Invalidate cache on mutation
      fetchAssets(true);
    } catch (err) {
      toast.error("Gagal menambah aset: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- OPEN EDIT MODAL ---
  const handleOpenEdit = (asset) => {
    const activeAssignment = asset.User_Equipment?.find(ue => !ue.Tarikh_Pulang);
    
    setEditingAsset({
      ...asset,
      Assigned_User_ID: activeAssignment?.User_ID || '',
      Original_User_ID: activeAssignment?.User_ID || ''
    });
  };

  // --- SAVE EDIT ASSET ---
  const handleUpdateAsset = async (e) => {
    e.preventDefault();
    if (!editingAsset) return;
    setSubmitting(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      let computedStatus = editingAsset.Status;
      if (editingAsset.Assigned_User_ID) {
        computedStatus = 'Dalam Guna';
      } else if (!editingAsset.Assigned_User_ID && editingAsset.Status === 'Dalam Guna') {
        computedStatus = 'Tersedia';
      }

      const { error: updateError } = await supabase
        .from('ICT_Equipment')
        .update({
          No_Pendaftaran: editingAsset.No_Pendaftaran.trim(),
          Jenama: editingAsset.Jenama,
          Jenis: editingAsset.Jenis,
          No_Siri: editingAsset.No_Siri.trim(),
          Lokasi: editingAsset.Lokasi,
          Hak_Milik: editingAsset.Hak_Milik,
          Keadaan: editingAsset.Keadaan,
          Status: computedStatus,
          Tahun_Perolehan: editingAsset.Tahun_Perolehan
        })
        .eq('Equipment_ID', editingAsset.Equipment_ID);

      if (updateError) throw updateError;

      if (editingAsset.Assigned_User_ID !== editingAsset.Original_User_ID) {
        if (editingAsset.Original_User_ID) {
          await supabase
            .from('User_Equipment')
            .update({ Tarikh_Pulang: today, Catatan: 'Penukaran pengguna dari Admin' })
            .eq('Equipment_ID', editingAsset.Equipment_ID)
            .is('Tarikh_Pulang', null);
        }

        if (editingAsset.Assigned_User_ID) {
          await supabase
            .from('User_Equipment')
            .insert({
              User_ID: editingAsset.Assigned_User_ID,
              Equipment_ID: editingAsset.Equipment_ID,
              Tarikh_Diberi: today,
              Catatan: 'Agihan melalui edit aset'
            });
        }
      }

      await logHistory(
        editingAsset.Equipment_ID,
        editingAsset.Assigned_User_ID || null,
        'Kemaskini Aset',
        editingAsset.Status,
        computedStatus,
        'Maklumat aset dan agihan dikemaskini oleh admin'
      );

      toast.success("Maklumat aset berjaya dikemaskini!");
      setEditingAsset(null);
      cachedEquipmentData = null; // Invalidate cache on mutation
      fetchAssets(true);
    } catch (err) {
      toast.error("Gagal mengemaskini aset: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // FILTER LOGIC
  const filteredAssets = assets.filter(asset => {
    const q = debouncedSearch.toLowerCase();
    const matchesSearch =
      asset.No_Pendaftaran?.toLowerCase().includes(q) ||
      asset.Jenama?.toLowerCase().includes(q) ||
      asset.No_Siri?.toLowerCase().includes(q);

    const matchesJenis = filters.jenis === 'All' || asset.Jenis === filters.jenis;
    const matchesStatus = filters.status === 'All' || asset.Status === filters.status;
    const matchesLokasi = filters.lokasi === 'All' || asset.Lokasi === filters.lokasi;
    const matchesHakMilik = filters.hakMilik === 'All' || asset.Hak_Milik === filters.hakMilik;

    const assetDate = asset.Tahun_Perolehan ? new Date(asset.Tahun_Perolehan) : null;
    const start = filters.dateStart ? new Date(filters.dateStart) : null;
    const end = filters.dateEnd ? new Date(filters.dateEnd) : null;

    let matchesDate = true;
    if (start && assetDate && assetDate < start) matchesDate = false;
    if (end && assetDate && assetDate > end) matchesDate = false;

    return matchesSearch && matchesJenis && matchesStatus && matchesLokasi && matchesHakMilik && matchesDate;
  });

  // PAGINATION CALCULATION LOGIC
  const totalItems = filteredAssets.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pengurusan Peralatan</h2>
          <p className="text-sm text-slate-600 mt-1">Urus inventori peralatan ICT dan rekod agihan pengguna</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
         type="button">
          <Plus className="w-4 h-4" /> Tambah Aset Baru
        </button>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari No. Pendaftaran, Jenama atau No. Siri..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:ring-blue-500 focus:bg-white transition"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none text-slate-700 font-medium"
              value={filters.jenis}
              onChange={e => setFilters({ ...filters, jenis: e.target.value })}
            >
              <option value="All">Semua Jenis</option>
              {jenisOptions.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none text-slate-700 font-medium"
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="All">Semua Status</option>
              <option value="Tersedia">Tersedia (Dalam Stok)</option>
              <option value="Dalam Guna">Dalam Guna</option>
              <option value="Dalam Pembaikan">Dalam Pembaikan</option>
              <option value="Dilupuskan">Dilupuskan</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none text-slate-700 font-medium"
              value={filters.lokasi}
              onChange={e => setFilters({ ...filters, lokasi: e.target.value })}
            >
              <option value="All">Semua Lokasi</option>
              {lokasiOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none text-slate-700 font-medium"
              value={filters.hakMilik}
              onChange={e => setFilters({ ...filters, hakMilik: e.target.value })}
            >
              <option value="All">Semua Hak Milik</option>
              <option value="Kerajaan">Kerajaan</option>
              <option value="Swasta">Swasta</option>
            </select>
          </div>

          <div className="flex items-center gap-2 col-span-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <div className="flex items-center gap-2 w-full">
              <input
                type="date"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none text-slate-700"
                value={filters.dateStart}
                onChange={e => setFilters({ ...filters, dateStart: e.target.value })}
              />
              <span className="text-xs text-slate-400">ke</span>
              <input
                type="date"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none text-slate-700"
                value={filters.dateEnd}
                onChange={e => setFilters({ ...filters, dateEnd: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs tracking-wider">
            <tr>
              <th className="px-5 py-3.5">No. Pendaftaran</th>
              <th className="px-5 py-3.5">Nama Peralatan</th>
              <th className="px-5 py-3.5">Jenis</th>
              <th className="px-5 py-3.5">No Siri</th>
              <th className="px-5 py-3.5">Tahun Dibeli</th>
              <th className="px-5 py-3.5">Pengguna</th>
              <th className="px-5 py-3.5">Lokasi</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan="9" className="py-12">
                  <div className="space-y-3 animate-pulse px-5">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
                  </div>
                </td>
              </tr>
            ) : paginatedAssets.length === 0 ? (
              <tr><td colSpan="9" className="text-center py-12 text-slate-400">Tiada aset ditemui.</td></tr>
            ) : (
              paginatedAssets.map(asset => {
                const activeAssignment = asset.User_Equipment?.find(ue => !ue.Tarikh_Pulang);
                const activeUserName = activeAssignment?.users?.name;

                const isTersedia = asset.Status === 'Tersedia' || asset.Status === 'Available' || !asset.Status;
                const isDalamGuna = asset.Status === 'Dalam Guna' || asset.Status === 'Active';
                const isDisposed = asset.Status === 'Dilupuskan' || asset.Status === 'DISPOSED';

                return (
                  <tr key={asset.Equipment_ID} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">{asset.No_Pendaftaran}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{asset.Jenama} {asset.Jenis}</td>
                    <td className="px-5 py-4 text-slate-600">{asset.Jenis}</td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-600">{asset.No_Siri}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {asset.Tahun_Perolehan ? new Date(asset.Tahun_Perolehan).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td className="px-5 py-4">
                      {activeUserName ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-700">
                          <User className="w-3 h-3 text-slate-500" />
                          {activeUserName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Tiada Pengguna</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{asset.Lokasi}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isTersedia ? 'bg-blue-50 text-blue-700 border border-blue-200/60' :
                        isDalamGuna ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' :
                        isDisposed ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          isTersedia ? 'bg-blue-500' : isDalamGuna ? 'bg-emerald-500' : isDisposed ? 'bg-slate-400' : 'bg-rose-500'
                        }`}></span>
                        {isTersedia ? 'Tersedia' : isDalamGuna ? 'Dalam Guna' : isDisposed ? 'Dilupuskan' : asset.Status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setViewingAssetId(asset.Equipment_ID)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                          title="Lihat Sejarah & Profil Aset"
                         type="button">
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(asset)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                          title="Edit Aset"
                         type="button">
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* PAGINATION FOOTER */}
        {totalItems > 0 && (
          <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Paparkan</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="p-1.5 bg-white border border-slate-200 rounded-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>baris per halaman</span>
            </div>

            <div>
              Menunjukkan <span className="font-bold text-slate-900">{startIndex + 1}</span> hingga <span className="font-bold text-slate-900">{Math.min(endIndex, totalItems)}</span> daripada <span className="font-bold text-slate-900">{totalItems}</span> rekod
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                title="Halaman Sebelumnya"
               type="button">
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                title="Halaman Seterusnya"
               type="button">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: ASSET DETAIL & TIMELINE */}
      {viewingAssetId && (
        <AssetProfileModal
          equipmentId={viewingAssetId}
          onClose={() => setViewingAssetId(null)}
        />
      )}

      {/* MODAL: ADD ASSET */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Dialog pentadbiran">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center relative">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 border border-blue-500/30 rounded-2xl text-blue-400">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Tambah Aset Baru</h3>
                  <p className="text-xs text-slate-400">Daftarkan peralatan ICT baru ke dalam sistem inventori</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
               type="button" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="p-8 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Maklumat Pendaftaran</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">No. Pendaftaran *</label>
                    <input
                      required
                      type="text"
                      placeholder="cth: GOV-2024-001"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={newAsset.No_Pendaftaran}
                      onChange={e => setNewAsset({ ...newAsset, No_Pendaftaran: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">No. Siri *</label>
                    <input
                      required
                      type="text"
                      placeholder="cth: SN123456789"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={newAsset.No_Siri}
                      onChange={e => setNewAsset({ ...newAsset, No_Siri: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Laptop className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Spesifikasi Peralatan</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Jenama *</label>
                    <input
                      required
                      type="text"
                      placeholder="cth: Dell, HP, Lenovo"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={newAsset.Jenama}
                      onChange={e => setNewAsset({ ...newAsset, Jenama: e.target.value })}
                    />
                  </div>

                  <SearchableSelect
                    label="Jenis Peralatan *"
                    options={jenisOptions}
                    value={newAsset.Jenis}
                    onChange={(val) => setNewAsset({ ...newAsset, Jenis: val })}
                    placeholder="Pilih atau taip jenis..."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Penempatan & Pengguna</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SearchableSelect
                    label="Lokasi *"
                    options={lokasiOptions}
                    value={newAsset.Lokasi}
                    onChange={(val) => setNewAsset({ ...newAsset, Lokasi: val })}
                    placeholder="Pilih atau taip lokasi..."
                  />

                  <SearchableSelect
                    label="Nama Pengguna (Opsional)"
                    options={usersList.map(u => ({ label: `${u.name} (${u.email})`, value: u.id }))}
                    value={newAsset.Assigned_User_ID}
                    onChange={(val) => setNewAsset({ ...newAsset, Assigned_User_ID: val })}
                    placeholder="Cari pengguna..."
                    allowCustom={false}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Maklumat Tambahan</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Hak Milik *</label>
                    <select
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={newAsset.Hak_Milik}
                      onChange={e => setNewAsset({ ...newAsset, Hak_Milik: e.target.value })}
                    >
                      <option value="Kerajaan">Kerajaan</option>
                      <option value="Swasta">Swasta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Keadaan *</label>
                    <input
                      required
                      type="text"
                      placeholder="cth: Baik / Baru"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={newAsset.Keadaan}
                      onChange={e => setNewAsset({ ...newAsset, Keadaan: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tahun Perolehan *</label>
                    <input
                      required
                      type="date"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={newAsset.Tahun_Perolehan}
                      onChange={e => setNewAsset({ ...newAsset, Tahun_Perolehan: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer shadow-lg shadow-blue-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  {submitting ? "Memeriksa..." : "Simpan Aset ke Inventori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ASSET */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Dialog pentadbiran">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-slate-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/30 border border-blue-500/30 rounded-2xl text-blue-400">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Kemaskini Aset ICT</h3>
                  <p className="text-xs text-slate-400">Kemaskini butiran {editingAsset.No_Pendaftaran}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAsset(null)}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
               type="button" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAsset} className="p-8 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Maklumat Pendaftaran</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">No. Pendaftaran *</label>
                    <input
                      required
                      type="text"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={editingAsset.No_Pendaftaran || ''}
                      onChange={e => setEditingAsset({ ...editingAsset, No_Pendaftaran: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">No. Siri *</label>
                    <input
                      required
                      type="text"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={editingAsset.No_Siri || ''}
                      onChange={e => setEditingAsset({ ...editingAsset, No_Siri: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Laptop className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Spesifikasi Peralatan</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Jenama *</label>
                    <input
                      required
                      type="text"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={editingAsset.Jenama || ''}
                      onChange={e => setEditingAsset({ ...editingAsset, Jenama: e.target.value })}
                    />
                  </div>

                  <SearchableSelect
                    label="Jenis Peralatan *"
                    options={jenisOptions}
                    value={editingAsset.Jenis || ''}
                    onChange={(val) => setEditingAsset({ ...editingAsset, Jenis: val })}
                    placeholder="Pilih atau taip jenis..."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Penempatan & Pengguna</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SearchableSelect
                    label="Lokasi *"
                    options={lokasiOptions}
                    value={editingAsset.Lokasi || ''}
                    onChange={(val) => setEditingAsset({ ...editingAsset, Lokasi: val })}
                    placeholder="Pilih atau taip lokasi..."
                  />

                  <SearchableSelect
                    label="Nama Pengguna"
                    options={[
                      { label: '-- Tiada Pengguna (Simpan dalam Stok) --', value: '' },
                      ...usersList.map(u => ({ label: `${u.name} (${u.email})`, value: u.id }))
                    ]}
                    value={editingAsset.Assigned_User_ID || ''}
                    onChange={(val) => setEditingAsset({ ...editingAsset, Assigned_User_ID: val })}
                    placeholder="Tukar pengguna..."
                    allowCustom={false}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Status & Maklumat Tambahan</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Status Operasi *</label>
                    <select
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={editingAsset.Status || 'Tersedia'}
                      onChange={e => setEditingAsset({ ...editingAsset, Status: e.target.value })}
                    >
                      <option value="Tersedia">Tersedia</option>
                      <option value="Dalam Guna">Dalam Guna</option>
                      <option value="Dalam Pembaikan">Dalam Pembaikan</option>
                      <option value="Dilupuskan">Dilupuskan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Hak Milik *</label>
                    <select
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={editingAsset.Hak_Milik || 'Kerajaan'}
                      onChange={e => setEditingAsset({ ...editingAsset, Hak_Milik: e.target.value })}
                    >
                      <option value="Kerajaan">Kerajaan</option>
                      <option value="Swasta">Swasta</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Keadaan Fizikal *</label>
                    <input
                      required
                      type="text"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={editingAsset.Keadaan || 'Baik'}
                      onChange={e => setEditingAsset({ ...editingAsset, Keadaan: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Tahun Perolehan *</label>
                    <input
                      required
                      type="date"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                      value={editingAsset.Tahun_Perolehan ? editingAsset.Tahun_Perolehan.split('T')[0] : ''}
                      onChange={e => setEditingAsset({ ...editingAsset, Tahun_Perolehan: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer shadow-lg shadow-blue-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}