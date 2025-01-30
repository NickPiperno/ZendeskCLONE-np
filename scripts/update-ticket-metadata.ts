import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = resolve(__dirname, '..', '.env');
config({ path: envPath });

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Missing required environment variables: VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

// Create Supabase client with service role key
const supabaseServiceRole = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

interface Tag {
    name: string;
}

interface TicketTag {
    tags: Tag;
}

interface AuditLog {
    created_at: string;
    user_id: string;
    action_type: string;
    old_data: any;
    new_data: any;
}

interface StateTransition {
    from_state: string;
    to_state: string;
    timestamp: Date;
    user_id: string;
}

interface StatusHistoryEntry {
    status: string;
    timestamp: Date;
    user_id: string;
}

interface TicketMetadata {
    current_state: {
        name: string;
        entered_at: Date;
        updated_by: string;
    };
    state_transitions: StateTransition[];
    status_history: StatusHistoryEntry[];
    last_updated_by: string;
    source: string;
    sla_level: string;
    security_level?: 'critical' | 'high' | 'medium' | 'low';
    security_classification?: 'vulnerability' | 'compliance' | 'general';
}

interface Ticket {
    id: string;
    status: string;
    priority: string;
    user_id: string;
    assigned_to: string;
    created_at: string;
    updated_at: string;
    ticket_tags: TicketTag[];
}

async function getTicketHistory(ticketId: string): Promise<AuditLog[]> {
    const { data: logs, error } = await supabaseServiceRole
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'tickets')
        .eq('record_id', ticketId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error(`Error fetching audit logs for ticket ${ticketId}:`, error);
        return [];
    }

    return logs || [];
}

async function updateTicketMetadata() {
    try {
        // Get all tickets that need metadata update
        const { data: tickets, error: ticketsError } = await supabaseServiceRole
            .from('tickets')
            .select(`
                id,
                status,
                priority,
                user_id,
                assigned_to,
                created_at,
                updated_at,
                ticket_tags (
                    tags (
                        name
                    )
                )
            `) as { data: Ticket[] | null, error: any };

        if (ticketsError) {
            console.error('Error fetching tickets:', ticketsError);
            return;
        }

        if (!tickets) {
            console.error('No tickets found');
            return;
        }

        console.log(`Found ${tickets.length} tickets to update`);

        for (const ticket of tickets) {
            // Get ticket history from audit logs
            const auditLogs = await getTicketHistory(ticket.id);
            const creationTimestamp = new Date(ticket.created_at);
            const tags = ticket.ticket_tags?.map(tt => tt.tags.name) || [];

            // Build state transitions and status history from audit logs
            const stateTransitions: StateTransition[] = [];
            const statusHistory: StatusHistoryEntry[] = [];
            let lastKnownStatus = 'none';

            // Add initial creation state
            stateTransitions.push({
                from_state: 'none',
                to_state: 'open', // Assuming tickets start as 'open'
                timestamp: creationTimestamp,
                user_id: ticket.user_id // Creator made the initial transition
            });

            statusHistory.push({
                status: 'open',
                timestamp: creationTimestamp,
                user_id: ticket.user_id
            });

            // Process status changes from audit logs
            for (const log of auditLogs) {
                if (log.new_data?.status && log.new_data.status !== log.old_data?.status) {
                    const timestamp = new Date(log.created_at);
                    
                    stateTransitions.push({
                        from_state: log.old_data?.status || lastKnownStatus,
                        to_state: log.new_data.status,
                        timestamp: timestamp,
                        user_id: log.user_id
                    });

                    statusHistory.push({
                        status: log.new_data.status,
                        timestamp: timestamp,
                        user_id: log.user_id
                    });

                    lastKnownStatus = log.new_data.status;
                }
            }

            // Determine SLA level based on priority
            const slaLevel = ticket.priority === 'urgent' ? 'high' :
                           ticket.priority === 'high' ? 'medium' : 'standard';

            // Build metadata object
            const metadata: TicketMetadata = {
                current_state: {
                    name: ticket.status,
                    entered_at: statusHistory[statusHistory.length - 1]?.timestamp || creationTimestamp,
                    updated_by: statusHistory[statusHistory.length - 1]?.user_id || ticket.user_id
                },
                state_transitions: stateTransitions,
                status_history: statusHistory,
                last_updated_by: auditLogs[auditLogs.length - 1]?.user_id || ticket.assigned_to || ticket.user_id,
                source: 'web',
                sla_level: slaLevel
            };

            // Add security metadata if ticket has security-related tags
            if (tags.some(tag => ['security', 'vulnerability', 'compliance'].includes(tag))) {
                metadata.security_level = ticket.priority === 'urgent' ? 'critical' :
                                       ticket.priority === 'high' ? 'high' : 'medium';
                metadata.security_classification = tags.includes('vulnerability') ? 'vulnerability' :
                                                tags.includes('compliance') ? 'compliance' : 'general';
            }

            // Update the ticket with new metadata
            const { error: updateError } = await supabaseServiceRole
                .from('tickets')
                .update({ metadata })
                .eq('id', ticket.id);

            if (updateError) {
                console.error(`Error updating ticket ${ticket.id}:`, updateError);
                continue;
            }

            console.log(`Updated metadata for ticket ${ticket.id}`);
        }

        console.log('Finished updating ticket metadata');

    } catch (error) {
        console.error('Error in updateTicketMetadata:', error);
    }
}

// Run the update
updateTicketMetadata().catch(console.error); 