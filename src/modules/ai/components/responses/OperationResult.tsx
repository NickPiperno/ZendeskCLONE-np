import React from 'react';
import { Card, CardContent } from '../../../../ui/components/card';
import { Button } from '../../../../ui/components/button';
import { Badge } from '../../../../ui/components/badge';
import { ScrollArea } from '../../../../ui/components/scroll-area';
import { CheckCircle2, XCircle, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';

export type OperationStatus = 'success' | 'error' | 'warning';

export interface OperationResultAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

interface OperationResultProps {
  status: OperationStatus;
  title: string;
  message: string;
  details?: string;
  timestamp?: string;
  actions?: OperationResultAction[];
  onDismiss?: () => void;
}

export const OperationResult: React.FC<OperationResultProps> = ({
  status,
  title,
  message,
  details,
  timestamp,
  actions = [],
  onDismiss,
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle2 className="h-6 w-6 text-green-500" />,
          badgeVariant: 'default' as const,
          badgeClass: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
          borderClass: 'border-l-4 border-l-green-500',
        };
      case 'error':
        return {
          icon: <XCircle className="h-6 w-6 text-red-500" />,
          badgeVariant: 'destructive' as const,
          badgeClass: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
          borderClass: 'border-l-4 border-l-red-500',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
          badgeVariant: 'secondary' as const,
          badgeClass: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
          borderClass: 'border-l-4 border-l-yellow-500',
        };
    }
  };

  const { icon, badgeVariant, badgeClass, borderClass } = getStatusConfig();

  return (
    <Card className={`shadow-lg ${borderClass}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <p className="text-muted-foreground">{message}</p>
            </div>
          </div>
          <Badge variant={badgeVariant} className={badgeClass}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        {details && (
          <ScrollArea className="mt-4 max-h-[200px]">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Details</h4>
              <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap">
                {details}
              </pre>
            </div>
          </ScrollArea>
        )}

        {timestamp && (
          <p className="mt-4 text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleString()}
          </p>
        )}
      </CardContent>

      {(actions.length > 0 || onDismiss) && (
        <div className="flex justify-end gap-2 border-t bg-muted/50 mt-6 p-6">
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'default'}
              onClick={action.onClick}
              className="gap-2"
            >
              {action.label}
              {action.icon || <ArrowRight className="h-4 w-4" />}
            </Button>
          ))}
          {onDismiss && (
            <Button variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}; 
