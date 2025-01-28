# Agent Matching System Documentation

## Overview
The agent matching system automatically assigns tickets to the most suitable agents based on multiple criteria:
- Required skills and proficiency levels
- Agent availability (schedule)
- Current workload
- Time zone considerations (EST)

## Core Components

### 1. Database Tables Required
- `tickets`: Stores ticket information
- `ticket_skills`: Maps required skills to tickets
- `user_skills`: Maps skills and proficiency levels to agents
- `team_schedules`: Stores agent work schedules
- `profiles`: Contains agent information

### 2. Main Function: `find_best_agent_match`

```sql
find_best_agent_match(p_ticket_id UUID) RETURNS UUID
```

#### Input
- `p_ticket_id`: UUID of the ticket needing assignment

#### Output
- Returns: UUID of the best matching agent, or NULL if no match found

### 3. Matching Process

#### Step 1: Ticket Validation
```sql
SELECT EXISTS (
    SELECT 1 FROM tickets 
    WHERE id = p_ticket_id AND deleted = false
)
```
- Verifies ticket exists and isn't deleted
- Returns NULL if ticket invalid

#### Step 2: Time and Schedule Handling
- Uses EST (America/New_York) timezone
- Converts current time to EST
- Maps days: 1 (Monday) through 7 (Sunday)
- Handles Sunday conversion from 0 to 7

#### Step 3: Agent Selection Criteria
The function uses a single query with multiple joins to find the best agent:

1. **Skills Match**:
```sql
JOIN user_skills us ON us.user_id = p.id
JOIN ticket_skills ts ON ts.skill_id = us.skill_id 
    AND ts.ticket_id = p_ticket_id
```
- Agent must have ALL required skills
- Verified using COUNT comparison in HAVING clause

2. **Schedule Availability**:
```sql
JOIN team_schedules sch ON sch.user_id = p.id
    AND sch.day_of_week = v_current_day
    AND sch.is_active = true
    AND sch.deleted = false
    AND v_current_time BETWEEN sch.start_time AND sch.end_time
```
- Must be within agent's working hours
- Schedule must be active and not deleted
- Day must match current EST day

3. **Agent Role**:
```sql
WHERE p.role = 'agent'
```
- Only considers users with 'agent' role

4. **Ranking Criteria**:
```sql
ORDER BY
    SUM(us.proficiency_level) DESC,  -- Higher proficiency preferred
    (SELECT COUNT(*)                 -- Lower workload preferred
     FROM tickets t
     WHERE t.assigned_to = p.id
         AND t.status NOT IN ('resolved', 'closed')
         AND t.deleted = false
    ) ASC
```

### 4. Required Permissions
```sql
GRANT EXECUTE ON FUNCTION public.find_best_agent_match(UUID) TO authenticated;
```
- Function requires authentication
- Uses SECURITY DEFINER for consistent permissions

## Usage in TypeScript

### Service Methods

1. **Direct Match Finding**:
```typescript
static async findBestAgentMatch(ticketId: string): Promise<string | null>
```

2. **Auto Assignment**:
```typescript
static async autoAssignTicket(ticketId: string): Promise<string | null>
```

3. **Manual Reassignment**:
```typescript
static async reassignTicket(ticketId: string): Promise<{ data: string | null, error: string | null }>
```

## Troubleshooting

### Common Issues

1. **No Agent Found**
   - Verify ticket has required skills
   - Check agent schedules in EST timezone
   - Confirm agents have matching skills
   - Verify schedule is active and not deleted

2. **Time Zone Issues**
   - System uses America/New_York (EST)
   - Schedule times stored in EST
   - Day of week: 1 (Monday) to 7 (Sunday)

3. **Schedule Matching**
   - Current time must be BETWEEN start_time AND end_time
   - Day must match exactly
   - Schedule must be active (is_active = true)
   - Schedule must not be deleted (deleted = false)

### Debugging
The function includes extensive logging:
- Database and session timezone
- Current EST time and day
- All schedules in the system
- Number of active schedules
- Selected agent's schedule

## Maintenance Notes

1. **Time Zone Handling**
   - All time comparisons done in EST
   - Frontend converts to EST using:
     ```typescript
     new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
     ```
   - Backend uses:
     ```sql
     CURRENT_TIME AT TIME ZONE 'America/New_York'
     ```

2. **Schedule Format**
   - Times stored as TIME type
   - Days stored as INTEGER (1-7)
   - Direct time comparison using BETWEEN operator

3. **Performance Considerations**
   - Uses single query with JOINs
   - Avoids CTEs for Supabase compatibility
   - Includes appropriate indexes on:
     - team_schedules(user_id, day_of_week)
     - user_skills(user_id, skill_id)
     - ticket_skills(ticket_id, skill_id) 