const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./auth'); // 1. Require your auth.js routes
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 2. Mount auth routes under /api/auth
app.use('/api/auth', authRoutes);

// Initialize Database Schema based on ERD
const initDb = async () => {
  try {
    // 1. User Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        "ID" SERIAL PRIMARY KEY,
        "Password" VARCHAR(255) NOT NULL,
        "Nama_Pengguna" VARCHAR(150) NOT NULL,
        "Role" VARCHAR(20) CHECK ("Role" IN ('Admin', 'User')) DEFAULT 'User',
        "Email" VARCHAR(100) UNIQUE NOT NULL,
        "No_Tel" VARCHAR(20),
        "Status" VARCHAR(20) DEFAULT 'Aktif',
        "Tarikh_Daftar" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. ICT_Equipment Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ICT_Equipment" (
        "Equipment_ID" SERIAL PRIMARY KEY,
        "Asset_Code" VARCHAR(100) UNIQUE,
        "QR_Token" VARCHAR(255),
        "No_Pendaftaran" VARCHAR(100),
        "Hak_Milik" VARCHAR(100),
        "No_Siri" VARCHAR(100),
        "Jenis" VARCHAR(100),
        "Jenama" VARCHAR(100),
        "Tahun_Perolehan" INT,
        "Lokasi" VARCHAR(150),
        "Status" VARCHAR(30) CHECK ("Status" IN ('Aktif', 'Rosak', 'Dalam_Pembaikan', 'Lupus')) DEFAULT 'Aktif',
        "Keadaan" VARCHAR(100),
        "Tarikh_Daftar" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "Tarikh_Kemaskini" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. User_Equipment Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "User_Equipment" (
        "User_ID" INT REFERENCES "User"("ID") ON DELETE CASCADE,
        "Equipment_ID" INT REFERENCES "ICT_Equipment"("Equipment_ID") ON DELETE CASCADE,
        "Tarikh_Diberi" DATE DEFAULT CURRENT_DATE,
        "Tarikh_Pulang" DATE,
        "Catatan" TEXT,
        "Status" VARCHAR(20) CHECK ("Status" IN ('Disahkan', 'Menunggu_Pengesahan', 'Dipulangkan')) DEFAULT 'Disahkan',
        PRIMARY KEY ("User_ID", "Equipment_ID")
      );
    `);

    // 4. Equipment_Report Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Equipment_Report" (
        "Report_ID" SERIAL PRIMARY KEY,
        "Equipment_ID" INT REFERENCES "ICT_Equipment"("Equipment_ID") ON DELETE CASCADE,
        "User_ID" INT REFERENCES "User"("ID") ON DELETE CASCADE,
        "Tarikh_Laporan" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "Masalah" TEXT NOT NULL,
        "Kategori" VARCHAR(30) CHECK ("Kategori" IN ('Hardware', 'Software', 'Network')),
        "Gambar" VARCHAR(255),
        "Status_Laporan" VARCHAR(30) CHECK ("Status_Laporan" IN ('Baru', 'Dalam_Siasatan', 'Selesai')) DEFAULT 'Baru',
        "Catatan" TEXT
      );
    `);

    // 5. Equipment_Repair Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Equipment_Repair" (
        "Repair_ID" SERIAL PRIMARY KEY,
        "Equipment_ID" INT REFERENCES "ICT_Equipment"("Equipment_ID") ON DELETE CASCADE,
        "Report_ID" INT REFERENCES "Equipment_Report"("Report_ID") ON DELETE SET NULL,
        "Tarikh_Hantar" DATE DEFAULT CURRENT_DATE,
        "Masalah" TEXT,
        "Tindakan" TEXT,
        "Status_Pembaikan" VARCHAR(50),
        "Tarikh_Siap" DATE,
        "Kos" DECIMAL(10, 2) DEFAULT 0.00,
        "Catatan" TEXT
      );
    `);

    // 6. Equipment_Disposal Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Equipment_Disposal" (
        "Disposal_ID" SERIAL PRIMARY KEY,
        "Equipment_ID" INT REFERENCES "ICT_Equipment"("Equipment_ID") ON DELETE CASCADE,
        "Tarikh_Lupus" DATE DEFAULT CURRENT_DATE,
        "Sebab_Lupus" TEXT,
        "Status" VARCHAR(30) CHECK ("Status" IN ('Dalam_Proses', 'Selesai')) DEFAULT 'Dalam_Proses',
        "Catatan" TEXT
      );
    `);

    // 7. Notification Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "Notification_ID" SERIAL PRIMARY KEY,
        "User_ID" INT REFERENCES "User"("ID") ON DELETE CASCADE,
        "Report_ID" INT REFERENCES "Equipment_Report"("Report_ID") ON DELETE CASCADE,
        "Pesan" TEXT NOT NULL,
        "Jenis" VARCHAR(50),
        "Read_Status" BOOLEAN DEFAULT FALSE,
        "Tarikh" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Equipment_History Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "Equipment_History" (
        "History_ID" SERIAL PRIMARY KEY,
        "Equipment_ID" INT REFERENCES "ICT_Equipment"("Equipment_ID") ON DELETE CASCADE,
        "User_ID" INT REFERENCES "User"("ID") ON DELETE SET NULL,
        "Tindakan" VARCHAR(100),
        "Status_Lama" VARCHAR(50),
        "Status_Baru" VARCHAR(50),
        "Catatan" TEXT,
        "Tarikh" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('All ERD database tables initialized successfully in Supabase!');
  } catch (err) {
    console.error('Error initializing tables:', err);
  }
};

initDb();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));