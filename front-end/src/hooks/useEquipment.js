import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useEquipment() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ICT_Equipment').select('*');
    if (!error && data) setDevices(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const submitComplaint = async ({ equipmentId, userId, masalah, kategori }) => {
    // 1. Tambah laporan aduan
    const { error: reportError } = await supabase
      .from('Equipment_Report')
      .insert([{ Equipment_ID: equipmentId, User_ID: userId, Masalah: masalah, Kategori: kategori, Status_Laporan: 'Baru' }]);

    if (reportError) throw reportError;

    // 2. Kemaskini status peranti kepada 'Rosak'
    const { error: updateError } = await supabase
      .from('ICT_Equipment')
      .update({ Status: 'Rosak' })
      .eq('Equipment_ID', equipmentId);

    if (updateError) throw updateError;
    await fetchDevices();
  };

  const submitDisposal = async ({ equipmentId, sebabLupus }) => {
    const { error } = await supabase
      .from('Equipment_Disposal')
      .insert([{ Equipment_ID: equipmentId, Sebab_Lupus: sebabLupus, Status: 'Dalam_Proses' }]);

    if (error) throw error;
  };

  return { devices, loading, fetchDevices, submitComplaint, submitDisposal };
}