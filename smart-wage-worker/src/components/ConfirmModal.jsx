import React from 'react';
import { X, Check } from 'lucide-react';

const ConfirmModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText = "Confirm", 
    cancelText = "Cancel",
    type = "primary" // primary, danger, success
}) => {
    if (!isOpen) return null;

    return (
        <div className="glass-modal-overlay" onClick={onClose}>
            <div className="glass-modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>
                    <X size={24} />
                </button>
                
                <div className="text-center mb-6">
                    <div className={`modal-icon-header ${type}`}>
                        {type === 'danger' ? <X size={32} /> : <Check size={32} />}
                    </div>
                    <h2 className="mt-4">{title}</h2>
                    <p className="text-light mt-2">{message}</p>
                </div>

                <div className="flex gap-4">
                    <button className="btn btn-ghost flex-1" onClick={onClose}>
                        {cancelText}
                    </button>
                    <button 
                        className={`btn btn-${type} flex-1`} 
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
