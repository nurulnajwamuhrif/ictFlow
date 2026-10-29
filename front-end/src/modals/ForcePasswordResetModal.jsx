import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ForcePasswordResetModal({ userId, onComplete }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Kata laluan mestilah sekurang-kurangnya 6 aksara.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Kata laluan tidak sepadan.");
      return;
    }

    setLoading(true);
    try {
      // 1. Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (authError) throw authError;

      // 2. Clear first-login flag in public.users
      const { error: dbError } = await supabase
        .from('users')
        .update({ is_first_login: false })
        .eq('id', userId);

      if (dbError) throw dbError;

      toast.success("Kata laluan berjaya dikemaskini!");
      onComplete();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 space-y-6 animate-in zoom-in-95">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Kemaskini Kata Laluan</h3>
          <p className="text-xs text-slate-500">
            Ini adalah log masuk pertama anda. Sila tukar kata laluan lalai untuk keselamatan akaun.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Kata Laluan Baru *</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pasti Kata Laluan Baru *</label>
            <input
              required
              type="password"
              placeholder="••••••••"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Mengemaskini..." : "Simpan & Teruskan"}
          </button>
        </form>
      </div>
    </div>
  );
}