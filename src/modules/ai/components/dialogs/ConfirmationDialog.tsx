import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/components/dialog';
import { Button } from '../../../../ui/components/button';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export type ConfirmationType = 'default' | 'warning' | 'destructive';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  type?: ConfirmationType;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  type = 'default',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
}) => {
  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
          confirmVariant: 'secondary' as const,
          confirmClass: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        };
      case 'destructive':
        return {
          icon: <XCircle className="h-6 w-6 text-red-500" />,
          confirmVariant: 'destructive' as const,
          confirmClass: 'bg-red-500 hover:bg-red-600 text-white',
        };
      default:
        return {
          icon: <CheckCircle className="h-6 w-6 text-green-500" />,
          confirmVariant: 'default' as const,
          confirmClass: 'bg-primary hover:bg-primary/90',
        };
    }
  };

  const { icon, confirmVariant, confirmClass } = getTypeStyles();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {icon}
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmClass}
          >
            {isLoading ? 'Please wait...' : confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 