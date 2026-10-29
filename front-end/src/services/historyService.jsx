import { supabase } from '../lib/supabase';

export const logEquipmentHistory = async ({ equipmentId, userId = null, tindakan, statusLama, statusBaru, catatan = '' }) => {
  try {
    const { error } = await supabase.from('Equipment_History').insert({
      Equipment_ID: equipmentId,
      User_ID: userId,
      Tindakan: tindakan, // e.g., 'Pendaftaran', 'Agihan', 'Pembaikan', 'Pelupusan', 'Kemaskini'
      Status_Lama: statusLama || null,
      Status_Baru: statusBaru || null,
      Catatan: catatan,
      Tarikh: new Date().toISOString()
    });

    if (error) console.error("Gagal merekod sejarah aset:", error.message);
  } catch (err) {
    console.error("Ralat audit log:", err.message);
  }
};