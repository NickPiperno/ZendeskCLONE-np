import { useState, useCallback } from 'react';
import { ConfirmationType } from '../components/dialogs/ConfirmationDialog';

interface ConfirmationOptions {
  title: string;
  description: string;
  type?: ConfirmationType;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

const defaultState: ConfirmationState = {
  isOpen: false,
  title: '',
  description: '',
  type: 'default',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  resolve: null,
};

export const useConfirmation = () => {
  const [state, setState] = useState<ConfirmationState>(defaultState);

  const confirm = useCallback(
    (options: ConfirmationOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setState({
          ...defaultState,
          ...options,
          isOpen: true,
          resolve,
        });
      });
    },
    []
  );

  const handleClose = useCallback(() => {
    if (state.resolve) {
      state.resolve(false);
    }
    setState(defaultState);
  }, [state]);

  const handleConfirm = useCallback(() => {
    if (state.resolve) {
      state.resolve(true);
    }
    setState(defaultState);
  }, [state]);

  return {
    ...state,
    confirm,
    onClose: handleClose,
    onConfirm: handleConfirm,
  };
}; 