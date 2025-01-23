import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/components/dialog"
import { Button } from "@/ui/components/button"
import { Input } from "@/ui/components/input"
import { Select } from "@/ui/components/select"
import { TeamService } from '@/services/teams'
import type { Team, TeamMember, TeamSchedule } from '@/modules/teams/types/team.types'

interface TeamScheduleDialogProps {
  team: Team
  members: (TeamMember & { user: any })[]
  open: boolean
  onOpenChange: (isOpen: boolean) => void
  onSchedulesUpdated?: () => void
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
]

/**
 * Dialog for managing team member schedules
 */
export function TeamScheduleDialog({ team, members, open, onOpenChange, onSchedulesUpdated }: TeamScheduleDialogProps) {
  const [schedules, setSchedules] = useState<(TeamSchedule & { user: any })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [dayOfWeek, setDayOfWeek] = useState<number>(1) // Monday
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [submitting, setSubmitting] = useState(false)

  // Fetch team schedules
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const data = await TeamService.getTeamSchedules(team.id)
        setSchedules(data)
      } catch (err) {
        console.error('Error fetching schedules:', err)
        setError('Failed to load schedules')
      } finally {
        setLoading(false)
      }
    }

    if (open) {
      fetchSchedules()
    }
  }, [team.id, open])

  const handleAddSchedule = async () => {
    if (!selectedMember) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await TeamService.addTeamSchedule({
        team_id: team.id,
        user_id: selectedMember,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime
      })

      // Refetch schedules to get user details
      const updatedSchedules = await TeamService.getTeamSchedules(team.id)
      setSchedules(updatedSchedules)

      // Notify parent component
      onSchedulesUpdated?.()

      // Reset form
      setSelectedMember(null)
      setDayOfWeek(1)
      setStartTime('09:00')
      setEndTime('17:00')
    } catch (err) {
      console.error('Error adding schedule:', err)
      setError('Failed to add schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveSchedule = async (scheduleId: string) => {
    try {
      await TeamService.removeTeamSchedule(scheduleId)
      setSchedules(prev => prev.filter(schedule => schedule.id !== scheduleId))
      // Notify parent component
      onSchedulesUpdated?.()
    } catch (err) {
      console.error('Error removing schedule:', err)
      setError('Failed to remove schedule')
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Team Schedule</DialogTitle>
            <DialogDescription>
              Manage team member schedules and coverage.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Team Schedule</DialogTitle>
          <DialogDescription>
            Manage working hours for team members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <div className="p-3 text-sm rounded-md bg-destructive/10 text-destructive">
              {error}
            </div>
          )}

          {/* Add Schedule Form */}
          <div className="space-y-4 p-4 rounded-md border bg-muted/30">
            <h3 className="text-sm font-medium">Add Schedule</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Team Member
                </label>
                <Select
                  value={selectedMember || ''}
                  onValueChange={setSelectedMember}
                >
                  <option value="">Select member...</option>
                  {members.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.user.full_name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Day of Week
                </label>
                <Select
                  value={dayOfWeek.toString()}
                  onValueChange={(value) => setDayOfWeek(parseInt(value, 10))}
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index + 1} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  End Time
                </label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={handleAddSchedule}
              disabled={!selectedMember || submitting}
            >
              {submitting ? 'Adding...' : 'Add Schedule'}
            </Button>
          </div>

          {/* Schedules List */}
          {selectedMember && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Current Schedules</h3>
              <div className="grid grid-cols-2 gap-4">
                {schedules
                  .filter(s => s.user_id === selectedMember)
                  .map(schedule => (
                    <div
                      key={schedule.id}
                      className="p-3 rounded-md border bg-card"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">
                            {DAYS_OF_WEEK[schedule.day_of_week - 1]}
                          </p>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveSchedule(schedule.id)}
                          >
                            Remove
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
                        </p>
                      </div>
                    </div>
                  ))}
                {schedules.filter(s => s.user_id === selectedMember).length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">No schedules set</p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 