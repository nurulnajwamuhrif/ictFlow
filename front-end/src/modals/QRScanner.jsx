import React, { useEffect, useState } from 'react';
import { X, QrCode } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../lib/supabase';

export default function QRScanner({ onClose, onMatchFound }) {
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 220, height: 220 } },
      /* verbose= */ false
    );

    scanner.render(
      async (decodedText) => {
        scanner.clear();
        handleSearchCode(decodedText);
      },
      (error) => {
        // Ralat imbasan berterusan diabaikan semasa imbasan kamera berjalan
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  const handleSearchCode = async (code) => {
    const { data, error } = await supabase
      .from('ICT_Equipment')
      .select('*')
      .or(`QR_Token.eq.${code},Asset_Code.eq.${code},No_Siri.eq.${code}`)
      .single();

    if (error || !data) {
      setErrorMsg('Aset tidak dijumpai dalam pengkalan data.');
    } else {
      onMatchFound(data);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col justify-between p-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between text-white z-10">
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
          <X className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-wider">Imbas Kod QR Aset</span>
        <div className="w-9"></div>
      </div>

      <div className="my-auto max-w-sm mx-auto w-full bg-white/5 p-4 rounded-3xl border border-white/10">
        <div id="qr-reader" className="overflow-hidden rounded-2xl"></div>
        {errorMsg && <p className="text-xs text-rose-400 font-bold mt-3 text-center bg-rose-950/50 p-2 rounded-xl">{errorMsg}</p>}
      </div>

      <button onClick={() => handleSearchCode('ICT-0010')} className="w-full py-3 rounded-2xl bg-white/10 text-white font-bold text-xs flex items-center justify-center gap-2">
        <QrCode className="w-4 h-4 text-indigo-400" /> Simulasi QR (#ICT-0010)
      </button>
    </div>
  );
}