# Supabase Database Schema

> **Important Note**: All `user_id` and `assigned_to` fields now reference `profiles(id)` instead of `auth.users(id)` to provide direct access to user information and support lookups by both ID and full_name.

## Core Tables

### `profiles`
- `id` UUID (Primary Key, References `auth.users(id)`)
- `full_name` TEXT NOT NULL
- `role` TEXT NOT NULL
- `email` TEXT NOT NULL
- `is_active` BOOLEAN DEFAULT true
- UNIQUE(full_name)

### `teams`
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `name` TEXT NOT NULL UNIQUE
- `description` TEXT
- `is_active` BOOLEAN DEFAULT true
- `deleted` BOOLEAN DEFAULT false
- `deleted_at` TIMESTAMPTZ

### `team_members`
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `team_id` UUID (References `teams(id)`)
- `user_id` UUID (References `profiles(id)`)
- `is_team_lead` BOOLEAN DEFAULT false
- UNIQUE(team_id, user_id)

### `skills`
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `name` TEXT NOT NULL
- `description` TEXT
- `category` skill_category NOT NULL
- `is_active` BOOLEAN DEFAULT true

### `user_skills`
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `user_id` UUID (References `profiles(id)`)
- `skill_id` UUID (References `skills(id)`)
- `proficiency_level` INTEGER CHECK (proficiency_level BETWEEN 1 AND 5)
- UNIQUE(user_id, skill_id)

### `team_schedules`
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `team_id` UUID (References `teams(id)`)
- `user_id` UUID (References `profiles(id)`)
- `day_of_week` INTEGER CHECK (day_of_week BETWEEN 0 AND 6)
- `start_time` TIME NOT NULL
- `end_time` TIME NOT NULL
- `is_active` BOOLEAN DEFAULT true
- `deleted` BOOLEAN DEFAULT false
- CONSTRAINT valid_time_range CHECK (start_time < end_time)

## Ticket Management

### `tickets`
- `id` UUID PRIMARY KEY
- `title` TEXT NOT NULL
- `description` TEXT
- `status` TEXT
- `priority` TEXT
- `assigned_to` UUID (References `profiles(id)`)
- `created_by` UUID (References `profiles(id)`)
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `metadata` JSONB
- `deleted` BOOLEAN DEFAULT false
- `deleted_at` TIMESTAMPTZ

### `ticket_skills`
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `ticket_id` UUID (References `tickets(id)`)
- `skill_id` UUID (References `skills(id)`)
- `required_proficiency` INTEGER CHECK (required_proficiency BETWEEN 1 AND 5)
- UNIQUE(ticket_id, skill_id)

### `ticket_notes`
- `id` UUID PRIMARY KEY
- `ticket_id` UUID (References `tickets(id)`)
- `user_id` UUID (References `profiles(id)`)
- `content` TEXT NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `thread_id` UUID (References `ticket_threads(id)`)
- `message_type` message_type
- `metadata` JSONB

### `ticket_threads`
- `id` UUID PRIMARY KEY
- `ticket_id` UUID (References `tickets(id)`)
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()
- `title` TEXT
- `status` TEXT
- `ai_context` JSONB DEFAULT '{}'::jsonb
- `deleted` BOOLEAN DEFAULT false
- `deleted_at` TIMESTAMPTZ
- `created_by` UUID (References `profiles(id)`)

## Knowledge Base

### `kb_articles`
- `id` UUID PRIMARY KEY
- `title` TEXT NOT NULL
- `content` TEXT NOT NULL
- `category_id` UUID (References `kb_categories(id)`)
- `author_id` UUID (References `profiles(id)`)
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()

## AI Integration

### `ai_documents`
- `id` UUID PRIMARY KEY
- `content` TEXT NOT NULL
- `metadata` JSONB
- `document_type` TEXT NOT NULL
- `reference_id` UUID NOT NULL
- `title` TEXT
- `created_at` TIMESTAMPTZ DEFAULT NOW()
- `updated_at` TIMESTAMPTZ DEFAULT NOW()

## Custom Types

### `skill_category` ENUM
- `technical`
- `product`
- `language`
- `soft_skill`

### `message_type` ENUM
- (specific values not found in migrations, but used in ticket_notes)

## Key Relationships

1. **Team Management**
   - `team_members` links `teams` to `auth.users`
   - `team_schedules` links `teams` to `auth.users`

2. **Skill Management**
   - `user_skills` links `auth.users` to `skills`
   - `ticket_skills` links `tickets` to `skills`

3. **Ticket Management**
   - `tickets.assigned_to` references `auth.users(id)`
   - `ticket_notes` links `tickets` to `auth.users`
   - `ticket_threads` links to both `tickets` and `auth.users`

4. **User Management**
   - `profiles` extends `auth.users` with additional information
   - All user references (`user_id`, `assigned_to`, `created_by`) now link to `profiles(id)`
   - `profiles.full_name` is unique and can be used for lookups

## Indexes and Constraints

1. **Unique Constraints**
   - `teams.name`
   - `team_members(team_id, user_id)`
   - `user_skills(user_id, skill_id)`
   - `ticket_skills(ticket_id, skill_id)`

2. **Check Constraints**
   - `user_skills.proficiency_level` BETWEEN 1 AND 5
   - `ticket_skills.required_proficiency` BETWEEN 1 AND 5
   - `team_schedules.day_of_week` BETWEEN 0 AND 6
   - `team_schedules.valid_time_range` (start_time < end_time)

3. **Important Indexes**
   - `team_schedules(user_id, day_of_week)`
   - `user_skills(user_id, skill_id)`
   - `ticket_skills(ticket_id, skill_id)`

## Required Migrations

To implement these changes:

1. Add unique constraint to `profiles.full_name`
2. Update foreign key references from `auth.users` to `profiles`
3. Update queries to use `profiles` joins instead of direct auth.users references
4. Add indexes on `profiles.full_name` for efficient lookups

## Supabase RPC Functions

### Ticket Management
- `create_ticket(p_title text, p_description text, p_status ticket_status, p_priority ticket_priority, p_user_id uuid) returns tickets`
  - Creates a new ticket with the specified parameters
  - Security: Definer

- `add_ticket_skill(p_ticket_id uuid, p_skill_id uuid, p_required_proficiency integer) returns ticket_skills`
  - Adds a skill requirement to a ticket
  - Security: Definer

- `add_ticket_tag(p_ticket_id uuid, p_tag_id uuid) returns ticket_tags`
  - Adds a tag to a ticket
  - Security: Definer

- `remove_ticket_tag(p_ticket_id uuid, p_tag_id uuid) returns void`
  - Removes a tag from a ticket
  - Security: Definer

- `soft_delete_ticket(ticket_id uuid) returns void`
  - Soft deletes a ticket
  - Security: Definer

- `soft_delete_ticket_note(note_id uuid) returns void`
  - Soft deletes a ticket note
  - Security: Definer

- `update_ticket_state(p_ticket_id uuid, p_new_state text, p_user_id uuid) returns void`
  - Updates a ticket's state
  - Security: Definer

### Team Management
- `create_team(p_name text, p_description text, p_is_active boolean) returns teams`
  - Creates a new team
  - Security: Definer

- `add_team_member(p_team_id uuid, p_user_id uuid, p_is_team_lead boolean) returns team_members`
  - Adds a member to a team
  - Security: Definer

- `soft_delete_team(team_id uuid) returns void`
  - Soft deletes a team
  - Security: Definer

- `soft_delete_team_schedule(schedule_id uuid) returns void`
  - Soft deletes a team schedule
  - Security: Definer

### Assignment and Matching
- `auto_assign_ticket(p_ticket_id uuid) returns uuid`
  - Automatically assigns a ticket
  - Security: Definer

- `find_best_agent_match(p_ticket_id uuid) returns uuid`
  - Finds the best agent match for a ticket
  - Security: Definer

- `debug_agent_match(p_ticket_id uuid) returns TABLE(matched_agent_id uuid, debug_info jsonb)`
  - Debug information for agent matching
  - Security: Definer

### Metrics and Analytics
- `calculate_avg_response_time() returns double precision`
  - Calculates average response time
  - Security: Definer

- `get_agent_performance_metrics() returns TABLE(agent_id uuid, agent_name text, tickets_resolved bigint, avg_resolution_time_minutes double precision)`
  - Gets agent performance metrics
  - Security: Definer

- `get_ticket_resolution_metrics() returns TABLE(status text, avg_resolution_time_minutes double precision, ticket_count bigint)`
  - Gets ticket resolution metrics
  - Security: Definer

- `get_customer_ticket_summary(p_user_id uuid DEFAULT auth.uid()) returns TABLE(status text, count bigint, last_update timestamp with time zone)`
  - Gets customer ticket summary
  - Security: Definer

- `get_customer_ticket_timeline(p_ticket_id uuid) returns TABLE(event_time timestamp with time zone, event_type text, event_description text, actor_name text, thread_id uuid, thread_context jsonb)`
  - Gets customer ticket timeline
  - Security: Definer

### Skills and User Management
- `get_all_user_skills() returns TABLE(id uuid, user_id uuid, skill_id uuid, proficiency_level integer, user_name text, user_email text)`
  - Gets all user skills
  - Security: Definer

### Knowledge Base
- `search_kb_articles(search_query text, p_category_id uuid DEFAULT NULL::uuid) returns TABLE(id uuid, title text, content_preview text, category_id uuid, rank real)`
  - Searches knowledge base articles
  - Security: Definer

### System Triggers
- `handle_new_user() returns trigger`
  - Handles new user creation
  - Security: Definer

- `try_auto_assign_ticket() returns trigger`
  - Attempts to auto-assign tickets
  - Security: Definer

- `try_reassign_on_skills_change() returns trigger`
  - Attempts to reassign on skills change
  - Security: Definer

- `record_audit_log() returns trigger`
  - Records audit logs
  - Security: Definer

- `update_updated_at_column() returns trigger`
  - Updates updated_at column
  - Security: Invoker

- `trigger_set_timestamp() returns trigger`
  - Sets timestamps
  - Security: Invoker

### AI Document Management
- `sync_ticket_to_ai_documents() returns trigger`
  - Syncs tickets to AI documents
  - Security: Invoker

- `sync_team_to_ai_documents() returns trigger`
  - Syncs teams to AI documents
  - Security: Invoker

- `sync_kb_article_to_ai_documents() returns trigger`
  - Syncs KB articles to AI documents
  - Security: Invoker

- `match_documents(query_embedding vector, match_count integer, filter jsonb DEFAULT '{}') returns TABLE(id uuid, content text, metadata jsonb, embedding vector, similarity double precision)`
  - Matches documents based on embeddings
  - Security: Invoker

### System Monitoring
- `get_database_size() returns TABLE(table_name name, row_count bigint, total_size_bytes bigint)`
  - Gets database size information
  - Security: Definer

- `get_query_metrics() returns TABLE(query_type text, avg_exec_time double precision, calls bigint, rows_per_call double precision)`
  - Gets query performance metrics
  - Security: Definer

- `get_record_history(p_table_name text, p_record_id uuid) returns TABLE(created_at timestamp with time zone, user_email text, action_type text, changes jsonb)`
  - Gets record history
  - Security: Definer 