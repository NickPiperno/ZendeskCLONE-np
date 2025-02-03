import React from 'react';
import { OperationResult, type OperationResultAction } from '../responses/OperationResult';
import { RefreshCw, ArrowLeft, MessageSquare, RotateCcw } from 'lucide-react';

interface ErrorDetails {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp?: string;
}

interface ChatErrorMessageProps {
  error: ErrorDetails;
  onRetry?: () => void;
  onRollback?: () => void;
  onStartNewChat?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ChatErrorMessage: React.FC<ChatErrorMessageProps> = ({
  error,
  onRetry,
  onRollback,
  onStartNewChat,
  onDismiss,
  className = '',
}) => {
  const getErrorConfig = () => {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        return {
          title: 'Invalid Operation',
          message: 'The requested operation could not be completed due to validation errors.',
          status: 'warning' as const,
        };
      case 'PERMISSION_DENIED':
        return {
          title: 'Permission Denied',
          message: 'You do not have permission to perform this operation.',
          status: 'error' as const,
        };
      case 'OPERATION_FAILED':
        return {
          title: 'Operation Failed',
          message: 'The operation failed to complete. You can try again or start a new conversation.',
          status: 'error' as const,
        };
      case 'NETWORK_ERROR':
        return {
          title: 'Connection Error',
          message: 'There was a problem connecting to the server. Please check your connection and try again.',
          status: 'error' as const,
        };
      default:
        return {
          title: 'Something Went Wrong',
          message: error.message || 'An unexpected error occurred.',
          status: 'error' as const,
        };
    }
  };

  const { title, message, status } = getErrorConfig();

  type ActionItem = {
    label: string;
    onClick: () => void;
    icon: JSX.Element;
    variant: 'default' | 'outline' | 'ghost';
  };

  const actionItems: Array<ActionItem | undefined> = [
    onRetry && {
      label: 'Try Again',
      onClick: onRetry,
      icon: <RotateCcw className="h-4 w-4" />,
      variant: 'default' as const,
    },
    onRollback && {
      label: 'Undo Last Action',
      onClick: onRollback,
      icon: <ArrowLeft className="h-4 w-4" />,
      variant: 'outline' as const,
    },
    onStartNewChat && {
      label: 'Start New Chat',
      onClick: onStartNewChat,
      icon: <MessageSquare className="h-4 w-4" />,
      variant: 'ghost' as const,
    },
  ];

  const actions: OperationResultAction[] = actionItems.filter((action): action is ActionItem => Boolean(action));

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      <OperationResult
        status={status}
        title={title}
        message={message}
        details={error.details ? JSON.stringify(error.details, null, 2) : undefined}
        timestamp={error.timestamp}
        actions={actions}
        onDismiss={onDismiss}
      />
    </div>
  );
}; 
