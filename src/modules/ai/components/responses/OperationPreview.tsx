import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../../ui/components/dialog';
import { Button } from '../../../../ui/components/button';
import { Badge } from '../../../../ui/components/badge';
import { ScrollArea } from '../../../../ui/components/scroll-area';
import { Card } from '../../../../ui/components/card';

interface OperationDetails {
  domain: 'kb' | 'ticket' | 'team';
  operation: string;
  changes: {
    field: string;
    oldValue?: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;
}

interface OperationPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  operation: OperationDetails;
  isLoading?: boolean;
}

export const OperationPreview: React.FC<OperationPreviewProps> = ({
  isOpen,
  onClose,
  onConfirm,
  operation,
  isLoading = false,
}) => {
  // Format domain and operation for display
  const formatTitle = (domain: string, operation: string) => {
    const domainMap = {
      kb: 'Knowledge Base',
      ticket: 'Ticket',
      team: 'Team'
    };
    return `${domainMap[domain as keyof typeof domainMap]} ${operation.replace(/_/g, ' ')}`;
  };

  // Render change preview
  const renderChangePreview = (change: OperationDetails['changes'][0]) => {
    const { field, oldValue, newValue } = change;
    
    return (
      <Card key={field} className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{field}</span>
          <Badge variant={oldValue ? 'outline' : 'default'}>
            {oldValue ? 'Update' : 'New'}
          </Badge>
        </div>
        {oldValue && (
          <div className="text-sm text-muted-foreground line-through mt-2">
            {JSON.stringify(oldValue)}
          </div>
        )}
        <div className="text-sm font-medium mt-2">
          {JSON.stringify(newValue)}
        </div>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {formatTitle(operation.domain, operation.operation)}
          </DialogTitle>
          <DialogDescription>
            Please review the following changes before confirming.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] mt-4">
          <div className="space-y-4">
            {operation.changes.map(renderChangePreview)}
            
            {operation.metadata && (
              <>
                <div className="h-px bg-border my-4" />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Additional Information</h4>
                  <pre className="text-xs bg-muted p-2 rounded">
                    {JSON.stringify(operation.metadata, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Confirming...' : 'Confirm Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 