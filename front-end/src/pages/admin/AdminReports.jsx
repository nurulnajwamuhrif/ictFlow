import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  User, 
  Laptop, 
  AlertCircle, 
  Wrench, 
  CheckCircle2, 
  Send 
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// --- MODULE-LEVEL CACHE (Lives outside component to persist across tab switches) ---
let cachedReportsData = null;
let lastFetchTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds cache duration

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Search State
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI State
  const [expandedReportId, setExpandedReportId] = useState(null);

  // Initial Fetch & Real-time Subscription
  useEffect(() => {
    fetchReports();

    const reportChannel = supabase
      .channel('admin-reports-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Equipment_Report',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newReport } = await supabase
              .from('Equipment_Report')
              .select(`
                *,
                ICT_Equipment(Equipment_ID, Jenama, Jenis, Asset_Code, No_Siri, Status), 
                users(id, name, email)
              `)
              .eq('Report_ID', payload.new.Report_ID)
              .single();

            if (newReport) {
              setReports((prev) => {
                const updated = [newReport, ...prev];
                cachedReportsData = updated; // Update cache
                return updated;
              });
              toast.success(`Aduan baru diterima: RPT-${newReport.Report_ID}`);
            }
          } else if (payload.eventType === 'UPDATE') {
            setReports((prev) => {
              const updated = prev.map((r) =>
                r.Report_ID === payload.new.Report_ID
                  ? { ...r, ...payload.new }
                  : r
              );
              cachedReportsData = updated; // Update cache
              return updated;
            });
          } else if (payload.eventType === 'DELETE') {
            setReports((prev) => {
              const updated = prev.filter((r) => r.Report_ID !== payload.old.Report_ID);
              cachedReportsData = updated; // Update cache
              return updated;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportChannel);
    };
  }, []);

  const fetchReports = async (forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache if valid and not forced
    if (!forceRefresh && cachedReportsData && (now - lastFetchTimestamp < CACHE_TTL)) {
      setReports(cachedReportsData);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Equipment_Report')
        .select(`
          *,
          ICT_Equipment(Equipment_ID, Jenama, Jenis, Asset_Code, No_Siri, Status, User_Equipment(User_ID, Tarikh_Pulang)), 
          users(id, name, email)
        `)
        .order('Tarikh_Laporan', { ascending: false })
        .limit(50);

      if (error) throw error;

      cachedReportsData = data || [];
      lastFetchTimestamp = Date.now();
      setReports(cachedReportsData);
    } catch (err) {
      toast.error("Gagal memuatkan aduan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Status transition-colors duration-200 & Equipment_History logging logic
  const updateStatus = async (reportId, newStatus) => {
    try {
      const report = reports.find((r) => r.Report_ID === reportId);
      if (!report) return;

      const equipmentId = report.ICT_Equipment?.Equipment_ID;
      const previousEquipmentStatus = report.ICT_Equipment?.Status || 'Tersedia';
      const today = new Date().toISOString().split('T')[0];

      // 1. Update report status
      const { error: statusError } = await supabase
        .from('Equipment_Report')
        .update({ Status_Laporan: newStatus })
        .eq('Report_ID', reportId);

      if (statusError) throw statusError;

      // 2. Handle side effects and Equipment History based on status transition
      if (newStatus === 'Dalam_Siasatan') {
        if (equipmentId) {
          await supabase
            .from('ICT_Equipment')
            .update({ Status: 'Dalam Siasatan' })
            .eq('Equipment_ID', equipmentId);

          await supabase
            .from('Equipment_History')
            .insert({
              Equipment_ID: equipmentId,
              User_ID: report.User_ID || null,
              Tindakan: 'Siasatan Aduan',
              Status_Lama: previousEquipmentStatus,
              Status_Baru: 'Dalam Siasatan',
              Catatan: `Siasatan bermula untuk aduan RPT-${report.Report_ID}: ${report.Masalah}`,
              Tarikh: new Date().toISOString()
            });
        }
        toast.success("Status dikemaskini kepada Dalam Siasatan");
      } 
      else if (newStatus === 'Dalam_Pembaikan') {
        // Insert into Equipment_Repair
        const { error: repairError } = await supabase
          .from('Equipment_Repair')
          .insert({ 
            Equipment_ID: equipmentId,
            Report_ID: reportId,
            Tarikh_Hantar: today,
            Masalah: report.Masalah,
            Status_Pembaikan: 'Dalam Pembaikan'
          });

        if (repairError) throw repairError;

        if (equipmentId) {
          await supabase
            .from('ICT_Equipment')
            .update({ Status: 'Dalam Pembaikan' })
            .eq('Equipment_ID', equipmentId);

          await supabase
            .from('Equipment_History')
            .insert({
              Equipment_ID: equipmentId,
              User_ID: report.User_ID || null,
              Tindakan: 'Hantar ke Pembaikan',
              Status_Lama: previousEquipmentStatus,
              Status_Baru: 'Dalam Pembaikan',
              Catatan: `Peralatan dihantar ke bengkel berikutan aduan RPT-${report.Report_ID}`,
              Tarikh: new Date().toISOString()
            });
        }

        toast.success("Peralatan dihantar ke pembaikan & direkodkan dalam sejarah!");
      } 
      else if (newStatus === 'Selesai') {
        await supabase
          .from('Equipment_Repair')
          .update({ Status_Pembaikan: 'Selesai', Tarikh_Siap: today })
          .eq('Report_ID', reportId);
          
        const activeAssignment = report.ICT_Equipment?.User_Equipment?.find(ue => !ue.Tarikh_Pulang);
        const restoredStatus = activeAssignment ? 'Dalam Guna' : 'Tersedia';

        if (equipmentId) {
          await supabase
            .from('ICT_Equipment')
            .update({ Status: restoredStatus })
            .eq('Equipment_ID', equipmentId);

          await supabase
            .from('Equipment_History')
            .insert({
              Equipment_ID: equipmentId,
              User_ID: report.User_ID || null,
              Tindakan: 'Aduan Selesai',
              Status_Lama: previousEquipmentStatus,
              Status_Baru: restoredStatus,
              Catatan: `Aduan RPT-${report.Report_ID} diselesaikan. Status dipulihkan kepada ${restoredStatus}`,
              Tarikh: new Date().toISOString()
            });
        }

        toast.success("Aduan dan pembaikan ditandakan selesai!");
      } 
      else {
        toast.success(`Status dikemaskini kepada ${newStatus.replace('_', ' ')}`);
      }

      // Local state update & Cache invalidation
      const updatedReports = reports.map((r) => (r.Report_ID === reportId ? { ...r, Status_Laporan: newStatus } : r));
      setReports(updatedReports);
      cachedReportsData = updatedReports;
    } catch (err) {
      toast.error("Tindakan gagal: " + err.message);
    }
  };

  const toggleExpand = (reportId) => {
    setExpandedReportId(expandedReportId === reportId ? null : reportId);
  };

  // Filter & Search Logic
  const filteredReports = reports.filter((r) => {
    let matchesStatus = true;
    if (statusFilter === 'Not Investigated') matchesStatus = r.Status_Laporan === 'Baru' || !r.Status_Laporan;
    else if (statusFilter === 'Investigating') matchesStatus = r.Status_Laporan === 'Dalam_Siasatan';
    else if (statusFilter === 'Completed Investigation') matchesStatus = r.Status_Laporan === 'Selesai' || r.Status_Laporan === 'Dalam_Pembaikan';

    let matchesDate = true;
    if (dateFilter) {
      const reportDate = new Date(r.Tarikh_Laporan).toISOString().split('T')[0];
      matchesDate = reportDate === dateFilter;
    }

    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      r.Masalah?.toLowerCase().includes(query) ||
      r.users?.name?.toLowerCase().includes(query) ||
      r.ICT_Equipment?.Asset_Code?.toLowerCase().includes(query) ||
      r.ICT_Equipment?.Jenama?.toLowerCase().includes(query) ||
      r.Report_ID.toString().includes(query);

    return matchesStatus && matchesDate && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pengurusan Aduan Kerosakan</h2>
          <p className="text-sm text-slate-600">Urus, siasat, dan selesaikan aduan peralatan serta rekodkan dalam sejarah aset.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari aduan, pengguna, kod..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:ring-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Filter Tabs & Date Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Semua', value: 'All' },
            { label: 'Belum Disiasat', value: 'Not Investigated' },
            { label: 'Dalam Siasatan', value: 'Investigating' },
            { label: 'Selesai / Pembaikan', value: 'Completed Investigation' },
          ].map((tab) => (
            <button 
              key={tab.value} 
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                statusFilter === tab.value 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500`}
             type="button">
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input 
            type="date" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600 cursor-pointer"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="text-xs text-red-500 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500" type="button">
              Kosongkan
            </button>
          )}
        </div>
      </div>

      {/* Report Cards List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-6 bg-slate-100 rounded w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
          Tiada aduan ditemui mengikut tapisan.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((r) => {
            const isUnread = !r.Status_Laporan || r.Status_Laporan === 'Baru';
            const isExpanded = expandedReportId === r.Report_ID;

            return (
              <div 
                key={r.Report_ID} 
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
                  isUnread 
                    ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/10' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="p-5">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">RPT-{r.Report_ID}</span>
                      {isUnread && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                          BARU
                        </span>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      r.Status_Laporan === 'Selesai' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : r.Status_Laporan === 'Dalam_Pembaikan'
                        ? 'bg-purple-100 text-purple-700'
                        : r.Status_Laporan === 'Dalam_Siasatan'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {r.Status_Laporan ? r.Status_Laporan.replace('_', ' ') : 'Baru'}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-base">
                    {r.ICT_Equipment?.Jenama} {r.ICT_Equipment?.Jenis || 'Peralatan Tidak Diketahui'}
                  </h4>
                  <p className="text-xs font-mono text-slate-400 mb-3">{r.ICT_Equipment?.Asset_Code || r.ICT_Equipment?.No_Pendaftaran}</p>
                  <p className="text-sm text-slate-700 italic mb-4">"{r.Masalah}"</p>

                  <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-100 gap-3">
                    <div className="text-sm text-slate-600">
                      Dilapor oleh <span className="font-semibold text-slate-700">{r.users?.name || 'Tidak diketahui'}</span> pada {new Date(r.Tarikh_Laporan).toLocaleDateString('en-GB')}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Step 1: Start Investigation */}
                      {(!r.Status_Laporan || r.Status_Laporan === 'Baru') && (
                        <button 
                          onClick={() => updateStatus(r.Report_ID, 'Dalam_Siasatan')}
                          className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                         type="button">
                          <Wrench className="w-3.5 h-3.5" /> Mula Siasatan
                        </button>
                      )}

                      {/* Step 2: Send to Repair */}
                      {r.Status_Laporan === 'Dalam_Siasatan' && (
                        <button 
                          onClick={() => updateStatus(r.Report_ID, 'Dalam_Pembaikan')}
                          className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                         type="button">
                          <Send className="w-3.5 h-3.5" /> Hantar ke Pembaikan
                        </button>
                      )}

                      {/* Step 3: Mark as Resolved */}
                      {(r.Status_Laporan === 'Dalam_Pembaikan' || r.Status_Laporan === 'Dalam_Siasatan') && (
                        <button 
                          onClick={() => updateStatus(r.Report_ID, 'Selesai')}
                          className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                         type="button">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Tandakan Selesai
                        </button>
                      )}

                      <button 
                        onClick={() => toggleExpand(r.Report_ID)}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors duration-200 cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                       type="button">
                        {isExpanded ? (
                          <>Tutup Butiran <ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <>Lihat Butiran <ChevronDown className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Dropdown Details Panel */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-100 p-5 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-xs">
                          <User className="w-3.5 h-3.5 text-slate-500" /> Maklumat Pengguna
                        </p>
                        <p className="font-semibold text-slate-800">{r.users?.name || 'N/A'}</p>
                        <p className="text-slate-500">{r.users?.email || 'N/A'}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-xs">
                          <Laptop className="w-3.5 h-3.5 text-slate-500" /> Maklumat Peralatan
                        </p>
                        <p className="font-semibold text-slate-800">{r.ICT_Equipment?.Jenama} {r.ICT_Equipment?.Jenis}</p>
                        <p className="font-mono text-slate-500">Kod: {r.ICT_Equipment?.Asset_Code || r.ICT_Equipment?.No_Pendaftaran || 'N/A'}</p>
                        <p className="font-mono text-slate-500">Siri: {r.ICT_Equipment?.No_Siri || 'N/A'}</p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200">
                        <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 text-slate-500" /> Butiran Tambahan
                        </p>
                        <p className="text-slate-500"><span className="font-semibold text-slate-700">Kategori:</span> {r.Kategori || 'Am'}</p>
                        <p className="text-slate-500"><span className="font-semibold text-slate-700">Tarikh Laporan:</span> {new Date(r.Tarikh_Laporan).toLocaleString('en-GB')}</p>
                        {r.Gambar && (
                          <a href={r.Gambar} target="_blank" rel="noreferrer" className="mt-1 inline-block text-blue-600 hover:underline font-bold">
                            Lihat Gambar Lampiran →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}