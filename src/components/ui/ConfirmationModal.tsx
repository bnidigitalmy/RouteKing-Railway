import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'success' | 'warning';
  icon?: React.ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Ya, Teruskan",
  cancelText = "Batal",
  variant = 'primary',
  icon
}) => {
  if (!isOpen) return null;

  const variants = {
    danger: "bg-red-600 hover:bg-red-700",
    primary: "bg-blue-600 hover:bg-blue-700",
    success: "bg-green-600 hover:bg-green-700",
    warning: "bg-orange-500 hover:bg-orange-600"
  };

  const iconColors = {
    danger: "text-red-500 bg-red-50",
    primary: "text-blue-500 bg-blue-50",
    success: "text-green-500 bg-green-50",
    warning: "text-orange-500 bg-orange-50"
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl overflow-hidden"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className={cn("p-4 rounded-full", iconColors[variant])}>
              {icon || <AlertCircle size={32} />}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-gray-900 leading-tight">
                {title}
              </h3>
              <p className="text-sm font-medium text-gray-500 px-2">
                {description}
              </p>
            </div>

            <div className="flex flex-col w-full gap-2 pt-2">
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={cn(
                  "w-full py-4 rounded-2xl text-white font-black text-sm transition-all active:scale-95 shadow-lg",
                  variants[variant]
                )}
              >
                {confirmText}
              </button>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-gray-50 text-gray-400 font-bold text-sm hover:bg-gray-100 transition-all active:scale-95"
              >
                {cancelText}
              </button>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
