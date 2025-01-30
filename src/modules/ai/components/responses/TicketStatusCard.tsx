import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../../../ui/components/card";
import { Badge } from "../../../../ui/components/badge";
import { Button } from "../../../../ui/components/button";
import { Clock, User, AlertTriangle } from "lucide-react";

interface TicketStatusCardProps {
  ticket: {
    id: string;
    title: string;
    status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigned_to?: {
      id: string;
      name: string;
    };
    updated_at?: string;
  };
  onUpdate?: (id: string) => void;
  onAssign?: (id: string) => void;
}

export const TicketStatusCard: React.FC<TicketStatusCardProps> = ({
  ticket,
  onUpdate,
  onAssign
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'pending': return 'bg-orange-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <Card className="w-full max-w-2xl hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">
              Ticket #{ticket.id}
            </CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {ticket.title}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Badge className={getStatusColor(ticket.status)}>
            {ticket.status}
          </Badge>
          <Badge className={getPriorityColor(ticket.priority)}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            {ticket.priority}
          </Badge>
          {ticket.assigned_to ? (
            <Badge variant="outline" className="flex items-center">
              <User className="h-3 w-3 mr-1" />
              {ticket.assigned_to.name}
            </Badge>
          ) : (
            onAssign && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAssign(ticket.id)}
                className="h-6"
              >
                Assign Ticket
              </Button>
            )
          )}
        </div>
        
        <div className="flex justify-between items-center mt-4">
          {ticket.updated_at && (
            <p className="text-xs text-gray-400 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              Updated: {new Date(ticket.updated_at).toLocaleDateString()}
            </p>
          )}
          {onUpdate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate(ticket.id)}
            >
              Update Status
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 