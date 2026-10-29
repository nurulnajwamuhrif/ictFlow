import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Laptop, Wrench, AlertTriangle, Trash2, Users, LogOut, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AdminSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navs = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/equipment', label: 'Equipment', icon: Laptop },
    { to: '/admin/reports', label: 'Reports', icon: AlertTriangle },
    { to: '/admin/repairs', label: 'Repairs', icon: Wrench },
    { to: '/admin/disposal', label: 'Disposal', icon: Trash2 },
    { to: '/admin/users', label: 'User Management', icon: Users },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen p-4 flex flex-col justify-between shrink-0">
      <div>
        <div className="flex items-center gap-3 px-3 py-4 border-b border-slate-800 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-none">ictFlow</h1>
            <span className="text-[10px] text-blue-400 font-medium">Admin Portal</span>
          </div>
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
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'hover:bg-slate-800 hover:text-white'
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
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </aside>
  );
}