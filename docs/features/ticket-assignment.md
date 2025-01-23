# Ticket Assignment Logic

This document explains the automatic ticket assignment system, which matches tickets with the most suitable agents based on skills, workload, and availability.

## Overview

The system uses a sophisticated scoring algorithm to find the best agent match for each ticket, considering:
- Required skills and agent proficiency levels
- Current agent workload
- Agent availability (work schedule)
- Ticket priority

## Assignment Process

### 1. Triggering Assignment

Assignment is automatically attempted when:
```sql
CREATE TRIGGER ticket_auto_assign_trigger
    AFTER INSERT OR UPDATE OF status, priority
    ON public.tickets
    FOR EACH ROW
    WHEN (NEW.assigned_to IS NULL)
```

- A new ticket is created
- A ticket's status or priority is updated
- Required skills are added/updated for a ticket
- The ticket is currently unassigned

### 2. Agent Matching Algorithm

#### 2.1 Availability Check
```sql
SELECT DISTINCT p.id as agent_id
FROM profiles p
JOIN team_members tm ON tm.user_id = p.id
JOIN team_schedules ts ON ts.user_id = p.id
WHERE 
    p.role = 'agent'
    AND p.is_active = true
    AND ts.day_of_week = current_day
    AND current_time BETWEEN ts.start_time AND ts.end_time
```

Only considers agents who are:
- Active in the system
- Currently scheduled to work
- Members of a team

#### 2.2 Skill Matching (50% of total score)
```sql
CASE 
    -- Perfect match or higher proficiency = 100%
    WHEN us.proficiency_level >= rs.required_proficiency THEN 100
    -- Partial match = percentage of required proficiency
    ELSE (us.proficiency_level::NUMERIC / rs.required_proficiency::NUMERIC) * 100
END
```

- Compares required ticket skills with agent proficiency levels
- Perfect or higher proficiency = 100% score
- Partial matches get proportional scores
- Minimum 60% skill match required

#### 2.3 Workload Balancing (30-50% of total score)
```sql
CASE 
    WHEN COUNT(t.id) = 0 THEN 100  -- No tickets = perfect score
    ELSE 100 - (COUNT(t.id) * 10)  -- -10 points per active ticket
END as workload_score
```

- Counts active tickets per agent
- -10 points per active ticket
- Maximum 5 active tickets allowed per agent
- Weight varies by ticket priority:
  - Urgent: 30% (prioritizes skills over workload)
  - High: 35%
  - Medium: 40%
  - Low: 50% (more even distribution)

### 3. Final Score Calculation
```sql
(
    -- Skill score weighted at 50%
    (ss.skill_score * 0.5) +
    -- Workload score weighted based on priority
    (ws.workload_score * 
        CASE ticket_priority
            WHEN 'urgent' THEN 0.3
            WHEN 'high' THEN 0.35
            WHEN 'medium' THEN 0.4
            WHEN 'low' THEN 0.5
        END
    )
) as match_score
```

- Combines skill and workload scores with priority-based weights
- Higher priority tickets favor skill matching over workload balance
- Lower priority tickets distribute more evenly across available agents

### 4. Assignment Execution

When a match is found:
```sql
UPDATE public.tickets
SET 
    assigned_to = selected_agent_id,
    status = 'in_progress',
    updated_at = NOW()
WHERE id = ticket_id;
```

- Assigns the ticket to the best-matching agent
- Updates ticket status to 'in_progress'
- Updates the timestamp

## Error Handling

The system includes comprehensive error handling:
- Returns detailed error messages with specific error codes
- Logs errors for debugging and monitoring
- Gracefully handles cases where no suitable agent is found

## API Integration

The assignment system can be accessed through the `TicketService` class:

```typescript
// Find best agent match without assigning
const matches = await TicketService.findBestAgentMatch(ticketId);

// Automatically assign to best matching agent
const assignedAgentId = await TicketService.autoAssignTicket(ticketId);
```

## Security

- All functions use `SECURITY DEFINER` to ensure consistent permissions
- Row-level security policies control access to ticket and skill data
- Only authenticated users can execute assignment functions
- Assignment changes are logged with timestamps 