import React, { createContext, useContext } from 'react';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationDialog } from '../components/dialogs/ConfirmationDialog';
import { ConfirmationType } from '../components/dialogs/ConfirmationDialog';

interface ConfirmationContextValue {
  confirm: (options: {
    title: string;
    description: string;
    type?: ConfirmationType;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export const useConfirmationDialog = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmationDialog must be used within a ConfirmationProvider');
  }
  return context;
};

interface ConfirmationProviderProps {
  children: React.ReactNode;
}

export const ConfirmationProvider: React.FC<ConfirmationProviderProps> = ({
  children,
}) => {
  const confirmation = useConfirmation();

  return (
    <ConfirmationContext.Provider value={{ confirm: confirmation.confirm }}>
      {children}
      <ConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={confirmation.onClose}
        onConfirm={confirmation.onConfirm}
        title={confirmation.title}
        description={confirmation.description}
        type={confirmation.type}
        confirmText={confirmation.confirmText}
        cancelText={confirmation.cancelText}
      />
    </ConfirmationContext.Provider>
  );
}; 