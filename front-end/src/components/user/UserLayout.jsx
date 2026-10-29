import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Laptop, AlertCircle, Bell, LogOut, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function UserLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navs = [
    { to: '/user', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/user/devices', label: 'My Devices', icon: Laptop },
    { to: '/user/complaints', label: 'Complaints', icon: AlertCircle },
    { to: '/user/notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 text-base">ictFlow Portal</span>
          </div>

          <nav className="space-y-1">
            {navs.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-rose-600 transition"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}