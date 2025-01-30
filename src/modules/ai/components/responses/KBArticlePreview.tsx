import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../../../ui/components/card";
import { Badge } from "../../../../ui/components/badge";
import { Button } from "../../../../ui/components/button";
import { Eye, Edit } from "lucide-react";

interface KBArticlePreviewProps {
  article: {
    id: string;
    title: string;
    content: string;
    category: {
      name: string;
      id: string;
    };
    status: 'draft' | 'published' | 'archived';
    last_updated?: string;
  };
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export const KBArticlePreview: React.FC<KBArticlePreviewProps> = ({
  article,
  onView,
  onEdit
}) => {
  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return `${content.substring(0, maxLength)}...`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-500';
      case 'draft': return 'bg-yellow-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <Card className="w-full max-w-2xl hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-2">
              {article.title}
            </CardTitle>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary">
                {article.category.name}
              </Badge>
              <Badge className={getStatusColor(article.status)}>
                {article.status}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(article.id)}
                title="View Article"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(article.id)}
                title="Edit Article"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {truncateContent(article.content)}
        </p>
        {article.last_updated && (
          <p className="text-xs text-gray-400 mt-2">
            Last updated: {new Date(article.last_updated).toLocaleDateString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}; 