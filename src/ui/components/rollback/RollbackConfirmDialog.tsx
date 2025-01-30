import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/dialog';
import { Button } from '../../components/button';

interface RollbackConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  entityId: string;
  operation: string;
}

export function RollbackConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  entityId,
  operation,
}: RollbackConfirmDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Rollback failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Rollback</DialogTitle>
          <DialogDescription>
            Are you sure you want to rollback this operation? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="font-medium">Operation:</div>
            <div>{operation}</div>
            <div className="font-medium">Entity ID:</div>
            <div>{entityId}</div>
          </div>
        </div>

        <div className="mt-4 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={isLoading}
          >
            {isLoading ? 'Rolling back...' : 'Confirm Rollback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
