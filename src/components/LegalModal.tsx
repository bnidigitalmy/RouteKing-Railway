import React from 'react';
import { motion } from 'motion/react';
import { X, Shield, Lock, Eye, FileText } from 'lucide-react';

interface LegalModalProps {
  onClose: () => void;
  type: 'privacy' | 'terms';
}

export const LegalModal: React.FC<LegalModalProps> = ({ onClose, type }) => {

  const content = {
    privacy: {
      title: "Dasar Privasi (Privacy Policy)",
      icon: <Shield className="text-blue-600" size={32} />,
      sections: [
        {
          title: "1. Maklumat Yang Kami Kumpul",
          text: "Kami mengumpul maklumat yang anda berikan secara sukarela seperti nama, alamat e-mel, dan data lokasi (GPS) untuk tujuan pengoptimuman laluan penghantaran anda."
        },
        {
          title: "2. Bagaimana Kami Menggunakan Maklumat",
          text: "Data lokasi anda digunakan secara eksklusif untuk merancang laluan terpantas. Kami tidak menjual atau berkongsi maklumat peribadi anda dengan pihak ketiga untuk tujuan pemasaran."
        },
        {
          title: "3. Keselamatan Data",
          text: "Kami melaksanakan langkah-langkah keselamatan yang ketat untuk melindungi data anda daripada akses yang tidak dibenarkan. Semua data disimpan dalam pelayan cloud yang selamat."
        },
        {
          title: "4. Hak Anda",
          text: "Anda mempunyai hak untuk mengakses, membetulkan, atau memadam data peribadi anda pada bila-bila masa melalui tetapan profil dalam aplikasi."
        }
      ]
    },
    terms: {
      title: "Terma & Syarat (Terms of Service)",
      icon: <FileText className="text-blue-600" size={32} />,
      sections: [
        {
          title: "1. Penerimaan Terma",
          text: "Dengan menggunakan RouteKing, anda bersetuju untuk terikat dengan terma dan syarat ini. Jika anda tidak bersetuju, sila berhenti menggunakan perkhidmatan kami."
        },
        {
          title: "2. Penggunaan Perkhidmatan",
          text: "RouteKing disediakan untuk membantu rider kurier merancang laluan. Anda bertanggungjawab sepenuhnya untuk mematuhi undang-undang jalan raya semasa menggunakan aplikasi ini."
        },
        {
          title: "3. Langganan & Pembayaran",
          text: "Sesetengah ciri memerlukan langganan berbayar. Pembayaran diproses melalui ToyyibPay. Tiada pemulangan wang (refund) akan diberikan selepas langganan diaktifkan."
        },
        {
          title: "4. Had Liabiliti",
          text: "RouteKing tidak bertanggungjawab atas sebarang kemalangan, kerosakan kenderaan, atau kehilangan parcel yang berlaku semasa anda menggunakan aplikasi ini."
        }
      ]
    }
  };

  const activeContent = content[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              {activeContent.icon}
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">{activeContent.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {activeContent.sections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="text-lg font-black text-gray-900">{section.title}</h3>
              <p className="text-gray-600 leading-relaxed font-medium">{section.text}</p>
            </div>
          ))}
          
          <div className="pt-8 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest text-center">
              Terakhir Dikemaskini: 3 April 2026 • RouteKing Team
            </p>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-center">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-all active:scale-95"
          >
            Faham & Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
};
