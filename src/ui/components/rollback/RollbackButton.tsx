import React from 'react';
import { Button } from '../../components/button';
import { ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { RollbackConfirmDialog } from './RollbackConfirmDialog';

interface RollbackButtonProps {
  entityId: string;
  operation: string;
  onRollback: () => Promise<void>;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function RollbackButton({
  entityId,
  operation,
  onRollback,
  variant = 'outline',
  size = 'sm',
  className
}: RollbackButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsConfirmOpen(true)}
      >
        <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
        Rollback
      </Button>

      <RollbackConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={onRollback}
        entityId={entityId}
        operation={operation}
      />
    </>
  );
} 