import React from 'react';
import Modal from './Modal';
import Button from './Button';

/**
 * ConfirmModal: confirmation modal with confirm/cancel buttons.
 */
export function ConfirmModal({
  open = false,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      title={title}
      maxWidth="440px"
      footer={
        <div className="confirm-modal-actions">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <p className="confirm-modal-message">{message}</p>
    </Modal>
  );
}

export default ConfirmModal;
