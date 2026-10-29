import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Search, Laptop, Shield, Mail, CheckCircle2, XCircle, Edit3, X, Loader2, Key, PlusCircle, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import AssignEquipmentModal from '../../modals/AssignEquipmentModal';

// --- MODULE-LEVEL CACHE (Lives outside component to persist across tab switches) ---
let cachedUsersData = null;
let lastFetchTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds cache duration

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [assigningUser, setAssigningUser] = useState(null);
  const [selectedUserEquipment, setSelectedUserEquipment] = useState(null);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [userEquipmentList, setUserEquipmentList] = useState([]);

  // New user state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'user'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async (forceRefresh = false) => {
    const now = Date.now();
    
    // Use cache if valid and not forced
    if (!forceRefresh && cachedUsersData && (now - lastFetchTimestamp < CACHE_TTL)) {
      setUsers(cachedUsersData);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          User_Equipment (
            Equipment_ID,
            Tarikh_Pulang,
            ICT_Equipment (
              Equipment_ID,
              Jenama,
              Jenis,
              No_Pendaftaran,
              No_Siri
            )
          )
        `)
        .order('name', { ascending: true })
        .limit(50);

      if (error) throw error;
      
      cachedUsersData = data || [];
      lastFetchTimestamp = Date.now();
      setUsers(cachedUsersData);
    } catch (err) {
      toast.error("Gagal memuatkan senarai pengguna: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Equipment Assigned to Selected User
  const handleViewEquipment = async (user) => {
    setSelectedUserEquipment(user);
    setEquipmentLoading(true);
    try {
      const { data, error } = await supabase
        .from('User_Equipment')
        .select(`
          *,
          ICT_Equipment (*)
        `)
        .eq('User_ID', user.id);

      if (error) throw error;
      setUserEquipmentList(data || []);
    } catch (err) {
      toast.error("Gagal memuatkan peralatan: " + err.message);
    } finally {
      setEquipmentLoading(false);
    }
  };

  // Hand back / Return asset from user back to stock with Audit History
  const handleReturnEquipment = async (equipmentId) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Mark as returned in User_Equipment
      const { error: returnError } = await supabase
        .from('User_Equipment')
        .update({
          Tarikh_Pulang: today,
          Catatan: 'Aset dipulangkan ke stok'
        })
        .eq('User_ID', selectedUserEquipment.id)
        .eq('Equipment_ID', equipmentId)
        .is('Tarikh_Pulang', null);

      if (returnError) throw returnError;

      // 2. Set Equipment status back to 'Tersedia' in ICT_Equipment
      const { error: statusError } = await supabase
        .from('ICT_Equipment')
        .update({ Status: 'Tersedia' })
        .eq('Equipment_ID', equipmentId);

      if (statusError) throw statusError;

      // 3. Log audit entry in Equipment_History
      await supabase
        .from('Equipment_History')
        .insert({
          Equipment_ID: equipmentId,
          User_ID: selectedUserEquipment.id,
          Tindakan: 'Pemulangan Aset',
          Status_Lama: 'Dalam Guna',
          Status_Baru: 'Tersedia',
          Catatan: `Peralatan dipulangkan oleh ${selectedUserEquipment.name} ke stok inventori`,
          Tarikh: new Date().toISOString()
        });

      toast.success("Peralatan berjaya dipulangkan ke stok!");
      handleViewEquipment(selectedUserEquipment);
      cachedUsersData = null; // Invalidate cache on mutation
      fetchUsers(true);
    } catch (err) {
      toast.error("Gagal memulangkan peralatan: " + err.message);
    }
  };

  // Add New User
  const handleAddUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const defaultPassword = '123456789';

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email.trim(),
        password: defaultPassword,
        options: {
          data: {
            name: newUser.name.trim(),
            role: newUser.role
          }
        }
      });

      if (authError) throw authError;

      const userId = authData.user?.id || crypto.randomUUID();

      const { error: dbError } = await supabase.from('users').upsert([{
        id: userId,
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        role: newUser.role,
        userstatus: 'active',
        is_first_login: true
      }]);

      if (dbError) throw dbError;

      toast.success(`Pengguna berjaya ditambah! Kata laluan lalai: ${defaultPassword}`);
      setShowAddModal(false);
      setNewUser({ name: '', email: '', role: 'user' });
      cachedUsersData = null; // Invalidate cache on mutation
      fetchUsers(true);
    } catch (err) {
      toast.error("Gagal menambah pengguna: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Update User Role & Status (With Auto Asset Unassignment & Audit History)
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);

    try {
      const today = new Date().toISOString().split('T')[0];

      // If user status is set to 'deactive' (resigned / offboarded)
      if (editingUser.userstatus === 'deactive') {
        // A. Find all active assigned equipment for this user
        const { data: activeAssignments } = await supabase
          .from('User_Equipment')
          .select('Equipment_ID')
          .eq('User_ID', editingUser.id)
          .is('Tarikh_Pulang', null);

        if (activeAssignments && activeAssignments.length > 0) {
          const equipmentIds = activeAssignments.map(a => a.Equipment_ID);

          // B. Set Tarikh_Pulang on User_Equipment
          await supabase
            .from('User_Equipment')
            .update({ Tarikh_Pulang: today, Catatan: 'Pengguna tidak aktif / berhenti' })
            .eq('User_ID', editingUser.id)
            .is('Tarikh_Pulang', null);

          // C. Set Equipment Status back to 'Tersedia' in ICT_Equipment
          await supabase
            .from('ICT_Equipment')
            .update({ Status: 'Tersedia' })
            .in('Equipment_ID', equipmentIds);

          // D. Log history entry for each unassigned asset
          const historyLogs = equipmentIds.map(eqId => ({
            Equipment_ID: eqId,
            User_ID: editingUser.id,
            Tindakan: 'Pemulangan Aset (Offboarding)',
            Status_Lama: 'Dalam Guna',
            Status_Baru: 'Tersedia',
            Catatan: `Aset dikembalikan ke stok kerana akaun pengguna ${editingUser.name} dinyahaktifkan`,
            Tarikh: new Date().toISOString()
          }));

          await supabase.from('Equipment_History').insert(historyLogs);
        }
      }

      // Update user record in database
      const { error } = await supabase
        .from('users')
        .update({
          role: editingUser.role,
          userstatus: editingUser.userstatus
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      toast.success("Maklumat pengguna dan rekod inventori berjaya dikemaskini!");
      setEditingUser(null);
      cachedUsersData = null; // Invalidate cache on mutation
      fetchUsers(true);
    } catch (err) {
      toast.error("Gagal mengemaskini pangkalan data: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Search Filter
  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pengurusan Pengguna</h2>
          <p className="text-sm text-slate-600 mt-1">Semak senarai pengguna, peranan, status dan peralatan yang diagihkan</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
         type="button">
          <UserPlus className="w-4 h-4" /> Tambah Pengguna
        </button>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, e-mel atau peranan..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:ring-blue-500 focus:bg-white transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* USERS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Pengguna</th>
              <th className="px-6 py-3.5">E-mel</th>
              <th className="px-6 py-3.5">Peranan</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-center">Aset Diagih</th>
              <th className="px-6 py-3.5 text-center">Tindakan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan="6" className="py-12">
                  <div className="space-y-3 animate-pulse px-6">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto"></div>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr><td colSpan="6" className="text-center py-12 text-slate-400">Tiada pengguna ditemui.</td></tr>
            ) : (
              filteredUsers.map(user => {
                const isDeactive = user.userstatus === 'deactive';
                const activeEquipmentCount = user.User_Equipment?.filter(e => !e.Tarikh_Pulang).length || 0;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{user.name || 'N/A'}</div>
                      <div className="text-xs font-mono text-slate-400">{user.id}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {user.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        user.role === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-200/60' : 'bg-slate-100 text-slate-700'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        isDeactive
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isDeactive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isDeactive ? 'Tidak Aktif' : 'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewEquipment(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-xs font-semibold text-slate-700 transition-colors duration-200 cursor-pointer border border-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                       type="button">
                        <Laptop className="w-3.5 h-3.5 text-slate-500" />
                        Lihat ({activeEquipmentCount})
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setAssigningUser(user)}
                          disabled={isDeactive}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer border border-emerald-200/60 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                          title="Agih Peralatan ICT Baru"
                         type="button">
                          <PlusCircle className="w-3.5 h-3.5" /> Agih Aset
                        </button>

                        <button
                          onClick={() => setEditingUser({ ...user })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                          title="Edit Peranan & Status"
                         type="button">
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: ASSIGN EQUIPMENT */}
      {assigningUser && (
        <AssignEquipmentModal
          user={assigningUser}
          onClose={() => setAssigningUser(null)}
          onSuccess={() => {
            cachedUsersData = null;
            fetchUsers(true);
          }}
        />
      )}

      {/* MODAL: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Dialog pentadbiran">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-white">Kemaskini Pengguna</h3>
                <p className="text-xs text-slate-400">{editingUser.name} ({editingUser.email})</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
               type="button" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peranan *</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                  value={editingUser.role || 'user'}
                  onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status Pengguna *</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                  value={editingUser.userstatus || 'active'}
                  onChange={e => setEditingUser({ ...editingUser, userstatus: e.target.value })}
                >
                  <option value="active">Aktif</option>
                  <option value="deactive">Tidak Aktif (Berhenti / Offboarding)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors duration-200 cursor-pointer shadow-lg shadow-blue-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  {submitting ? "Kemaskini..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW USER EQUIPMENT */}
      {selectedUserEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Dialog pentadbiran">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-white">Peralatan ICT Pengguna</h3>
                <p className="text-xs text-slate-400">Senarai aset di bawah pengawasan {selectedUserEquipment.name}</p>
              </div>
              <button
                onClick={() => setSelectedUserEquipment(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
               type="button" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {equipmentLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Memuatkan peralatan...
                </div>
              ) : userEquipmentList.filter(item => !item.Tarikh_Pulang).length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Tiada peralatan ICT aktif diagihkan kepada pengguna ini.
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1 divide-y divide-slate-100">
                  {userEquipmentList
                    .filter(item => !item.Tarikh_Pulang)
                    .map(item => {
                      const eq = item.ICT_Equipment;
                      return (
                        <div key={item.Equipment_ID} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{eq?.Jenama} {eq?.Jenis}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              {eq?.No_Pendaftaran} • SN: {eq?.No_Siri || '-'}
                            </div>
                            {item.Tarikh_Diberi && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                Tarikh Diberi: {new Date(item.Tarikh_Diberi).toLocaleDateString('en-GB')}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => handleReturnEquipment(item.Equipment_ID)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer border border-rose-200/60 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                            title="Pulangkan peralatan ke stok"
                           type="button">
                            <RotateCcw className="w-3.5 h-3.5" /> Pulangkan Aset
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelectedUserEquipment(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
               type="button">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW USER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Dialog pentadbiran">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100 overflow-hidden my-8">
            <div className="px-6 py-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Tambah Pengguna Baru</h3>
                  <p className="text-xs text-slate-400">Daftar staf baru untuk mengakses sistem</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
               type="button" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Penuh *</label>
                <input
                  required
                  type="text"
                  placeholder="cth: Ahmad Zaki"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat E-mel *</label>
                <input
                  required
                  type="email"
                  placeholder="cth: ahmad.zaki@example.com"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Peranan *</label>
                <select
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">User (Staf)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200/60 rounded-xl flex items-start gap-2.5 text-xs text-blue-800">
                <Key className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Kata Laluan Lalai:</span> Pengguna akan didaftarkan dengan kata laluan sementara <code className="bg-blue-100 px-1 py-0.5 rounded font-mono font-bold text-blue-900">123456789</code>. Mereka akan diminta untuk menukarnya semasa log masuk pertama.
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
                  {submitting ? "Mendaftar..." : "Simpan Pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}