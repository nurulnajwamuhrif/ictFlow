import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import { 
  LayoutDashboard, Laptop, AlertCircle, Clock, Bell, 
  LogOut, ShieldCheck, User, Settings, Users, FileText, Trash2, ChevronLeft 
} from 'lucide-react';

// --- Pages: Login ---
import Login from './pages/Login';

// --- Pages: User ---
import UserHome from './pages/user/UserHome';
import UserDevices from './pages/user/UserDevices';
import UserComplaints from './pages/user/UserComplaints';
import UserNotifications from './pages/user/UserNotifications';

// --- Pages: Admin ---
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEquipment from './pages/admin/AdminEquipment';
import AdminReports from './pages/admin/AdminReports';
import AdminRepairs from './pages/admin/AdminRepairs';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDisposal from './pages/admin/AdminDisposal';

// --- Modals ---
import AssetProfileModal from './modals/AssetProfileModal';
import ComplaintModal from './modals/ComplaintModal';
import QRScanner from './modals/QRScanner';
import AssignEquipmentModal from './modals/AssignEquipmentModal';

export default function App() {
  const { user, profile, loading, logout } = useAuth();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'detail'
  const [selectedId, setSelectedId] = useState(null); // ID of the asset/report being viewed

  // Modal State
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [complaintAsset, setComplaintAsset] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);

  // --- Detail View Helpers ---
  const openDetail = (id) => {
    setSelectedId(id);
    setViewMode('detail');
  };

  const closeDetail = () => {
    setSelectedId(null);
    setViewMode('list');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 text-sm font-medium">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="tracking-wide">Memuatkan Portal ictFlow...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  const isAdmin = profile?.role === 'admin';

  // Dynamic Navigation based on Role (Translated to Bahasa Malaysia)
  const navItems = isAdmin 
    ? [
        { id: 'dashboard', label: 'Utama', icon: LayoutDashboard },
        { id: 'equipment', label: 'Peralatan', icon: Laptop },
        { id: 'reports', label: 'Aduan', icon: FileText },
        { id: 'repairs', label: 'Pembaikan', icon: Settings },
        { id: 'disposal', label: 'Pelupusan', icon: Trash2 },
        { id: 'users', label: 'Pengguna', icon: Users },
      ]
    : [
        { id: 'overview', label: 'Utama', icon: LayoutDashboard },
        { id: 'assets', label: 'Aset Saya', icon: Laptop },
        { id: 'reports', label: 'Aduan', icon: AlertCircle },
        { id: 'activity', label: 'Aktiviti', icon: Clock },
      ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col md:flex-row">
      <Toaster position="top-right" />

      {/* SIDEBAR NAVIGATION */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md p-2 md:sticky md:top-0 md:h-screen md:w-64 md:p-5 flex flex-col justify-between shrink-0 border-t md:border-t-0 md:border-r border-slate-200 shadow-sm">
        <div className="flex flex-col w-full">
          {/* Logo Header */}
          <div className="hidden md:flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 tracking-tight text-base leading-none">ictFlow</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {isAdmin ? 'Pusat Kawalan Admin' : 'Portal Pekerja'}
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex justify-around items-center md:flex-col md:justify-start md:space-y-1 w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setViewMode('list'); // Reset to list view when switching tabs
                  }}
                  className={`flex flex-col md:flex-row items-center gap-2 md:gap-3 px-3 py-2 md:px-3.5 md:py-2.5 rounded-lg transition-all duration-150 w-full md:justify-start cursor-pointer text-xs md:text-sm font-medium ${
                    isActive ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-[10px] md:text-xs tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Sign Out */}
        <div className="hidden md:block pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
              <User className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate">{profile?.name || user.email}</p>
              <p className="text-[10px] text-slate-400 capitalize">{profile?.role === 'admin' ? 'Admin' : 'Pengguna'}</p>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Keluar
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md px-6 py-3.5 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm">ictFlow</span>
          </div>
          <div className="hidden md:block">
            <span className="text-xs text-slate-400 font-medium">Platform Pengurusan Aset ICT</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <button className="relative p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer">
              <Bell className="w-4 h-4" />
            </button>
            <button onClick={logout} className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
          
          {/* --- ADMIN VIEW ROUTER --- */}
          {isAdmin && (
            <>
              {activeTab === 'dashboard' && <AdminDashboard setActiveTab={setActiveTab} />}
              
              {activeTab === 'equipment' && (
                viewMode === 'list' 
                  ? <AdminEquipment onSelect={openDetail} /> 
                  : <AdminEquipmentDetail id={selectedId} onBack={closeDetail} />
              )}

              {activeTab === 'reports' && (
                viewMode === 'list' 
                  ? <AdminReports onSelect={openDetail} /> 
                  : <AdminReportDetail id={selectedId} onBack={closeDetail} />
              )}

              {activeTab === 'repairs' && <AdminRepairs />}
              {activeTab === 'disposal' && <AdminDisposal />}
              {activeTab === 'users' && <AdminUsers />}
            </>
          )}

          {/* --- USER VIEW ROUTER --- */}
          {!isAdmin && (
            <>
              {activeTab === 'overview' && (
                <UserHome 
                  userId={profile?.id} 
                  userName={profile?.name} 
                  onNavigate={setActiveTab} 
                  onOpenQR={() => setShowQRScanner(true)} 
                  onOpenComplaint={() => setShowComplaintModal(true)} 
                  onOpenProfile={setSelectedAsset} 
                />
              )}
              {activeTab === 'assets' && (
                <UserDevices 
                  userId={profile?.id} 
                  onSelectProfile={setSelectedAsset} 
                  onReportIssue={(dev) => { setComplaintAsset(dev); setShowComplaintModal(true); }} 
                />
              )}
              {activeTab === 'reports' && <UserComplaints userId={profile?.id} />}
              {activeTab === 'activity' && (
                <UserNotifications 
                  userId={profile?.id} 
                  onNavigateToReport={() => setActiveTab('reports')} 
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* GLOBAL MODALS */}
      {selectedAsset && (
        <AssetProfileModal 
          asset={selectedAsset} 
          onClose={() => setSelectedAsset(null)} 
          onReportIssue={() => { setComplaintAsset(selectedAsset); setSelectedAsset(null); setShowComplaintModal(true); }} 
        />
      )}
      {showComplaintModal && (
        <ComplaintModal 
          asset={complaintAsset} 
          userId={profile?.id} 
          onClose={() => { setShowComplaintModal(false); setComplaintAsset(null); }} 
          onSuccess={(msg) => toast.success(msg)} 
        />
      )}
      {showQRScanner && (
        <QRScanner 
          onClose={() => setShowQRScanner(false)} 
          onMatchFound={(asset) => { setShowQRScanner(false); setSelectedAsset(asset); }} 
        />
      )}
    </div>
  );
}