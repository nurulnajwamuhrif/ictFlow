import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ndjvzravspgnoorxutsq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kanZ6cmF2c3Bnbm9vcnh1dHNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NTgyMTksImV4cCI6MjEwNjIzNDIxOX0.3K63Q8qCGc6AqU_gdGA3Q1NEP1tDSWO8xhN6vA8WlUU'; // Tampal Legacy anon public key anda di sini

export const supabase = createClient(supabaseUrl, supabaseAnonKey);