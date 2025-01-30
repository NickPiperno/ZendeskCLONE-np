import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../../../ui/components/card";
import { Badge } from "../../../../ui/components/badge";
import { Button } from "../../../../ui/components/button";
import { Users, Award, CheckCircle2 } from "lucide-react";

interface TeamAssignmentCardProps {
  team: {
    id: string;
    name: string;
    lead?: {
      id: string;
      name: string;
    };
    members: Array<{
      id: string;
      name: string;
      role: string;
      skills: Array<{
        name: string;
        level: 'beginner' | 'intermediate' | 'expert';
      }>;
      availability: 'available' | 'busy' | 'away' | 'offline';
    }>;
    required_skills?: string[];
  };
  onViewTeam?: (id: string) => void;
  onAssignMember?: (teamId: string) => void;
}

export const TeamAssignmentCard: React.FC<TeamAssignmentCardProps> = ({
  team,
  onViewTeam,
  onAssignMember
}) => {
  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'away': return 'bg-orange-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'expert': return 'bg-purple-500';
      case 'intermediate': return 'bg-blue-500';
      case 'beginner': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full max-w-2xl hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2" />
              {team.name}
            </CardTitle>
            {team.lead && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 flex items-center">
                <Award className="h-4 w-4 mr-1" />
                Lead: {team.lead.name}
              </p>
            )}
          </div>
          {onViewTeam && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewTeam(team.id)}
            >
              View Team
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {team.required_skills && team.required_skills.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1">Required Skills:</p>
              <div className="flex flex-wrap gap-2">
                {team.required_skills.map((skill, index) => (
                  <Badge key={index} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-1">Team Members ({team.members.length}):</p>
            <div className="space-y-2">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between bg-secondary/20 p-2 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getAvailabilityColor(member.availability)}>
                      {member.availability}
                    </Badge>
                    {member.skills.length > 0 && (
                      <Badge className={getSkillLevelColor(member.skills[0].level)}>
                        {member.skills[0].name}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {onAssignMember && (
            <div className="flex justify-end mt-4">
              <Button
                variant="default"
                size="sm"
                onClick={() => onAssignMember(team.id)}
                className="flex items-center"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Assign Member
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}; 