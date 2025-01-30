import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
const envPath = resolve(process.cwd(), '.env');
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

// Add type definitions at the top of the file
interface TicketMetadata {
    current_state: {
        name: string;
        entered_at: Date;
        updated_by: string;
    };
    state_transitions: Array<{
        from_state: string;
        to_state: string;
        timestamp: Date;
        user_id: string;
    }>;
    status_history: Array<{
        status: string;
        timestamp: Date;
        user_id: string;
    }>;
    last_updated_by: string;
    source: string;
    sla_level: string;
    security_level?: 'critical' | 'high' | 'medium' | 'low';
    security_classification?: 'vulnerability' | 'compliance' | 'general';
}

// Update the template interface
interface TicketTemplate {
    title: string;
    description: string;
    tags: Array<'bug' | 'feature' | 'ui' | 'api' | 'technical' | 'billing' | 
                'urgent' | 'enhancement' | 'performance' | 'optimization' | 
                'integration' | 'account' | 'access' | 'security' | 'vulnerability' | 
                'compliance'>;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: 'technical' | 'product' | 'general';
}

// Update the ticket templates type
const ticketTemplates: TicketTemplate[] = [
    // Technical Support Tickets
    {
        title: "Cannot access dashboard",
        description: "I'm unable to access the main dashboard after logging in. The page shows a blank screen.",
        tags: ["bug", "ui", "access"],
        priority: "high",
        category: "technical"
    },
    {
        title: "API Authentication Error",
        description: "Getting 401 unauthorized errors when trying to use the API with valid credentials.",
        tags: ["api", "technical", "access"],
        priority: "high",
        category: "technical"
    },
    {
        title: "Database Connection Issues",
        description: "Experiencing intermittent connection drops to the database. Need urgent assistance.",
        tags: ["technical", "urgent"],
        priority: "urgent",
        category: "technical"
    },
    {
        title: "SSL Certificate Expired",
        description: "Our SSL certificate seems to have expired, causing security warnings for users.",
        tags: ["technical", "urgent", "access"],
        priority: "urgent",
        category: "technical"
    },
    {
        title: "Performance Degradation",
        description: "System response time has increased significantly in the past hour.",
        tags: ["performance", "technical"],
        priority: "high",
        category: "technical"
    },
    {
        title: "Memory Leak Detection",
        description: "Application memory usage is growing abnormally over time, causing slowdowns.",
        tags: ["performance", "technical", "optimization"],
        priority: "high",
        category: "technical"
    },
    {
        title: "Security Vulnerability Alert",
        description: "Detected potential SQL injection vulnerability in search functionality.",
        tags: ["technical", "urgent", "security"],
        priority: "urgent",
        category: "technical"
    },
    {
        title: "Load Balancer Configuration",
        description: "Need assistance with load balancer setup for high availability.",
        tags: ["technical", "performance"],
        priority: "high",
        category: "technical"
    },

    // Product-Related Tickets
    {
        title: "Feature Request: Dark Mode",
        description: "Would love to have a dark mode option for better visibility during night time usage.",
        tags: ["feature", "ui", "enhancement"],
        priority: "low",
        category: "product"
    },
    {
        title: "Bulk Import Feature Not Working",
        description: "The bulk import feature fails when trying to import more than 1000 records.",
        tags: ["bug", "feature", "technical"],
        priority: "medium",
        category: "product"
    },
    {
        title: "Enhancement: Custom Dashboard Widgets",
        description: "Request to add customizable widgets for the dashboard to track specific metrics.",
        tags: ["feature", "enhancement", "ui"],
        priority: "low",
        category: "product"
    },
    {
        title: "Mobile App Sync Issues",
        description: "Data isn't syncing properly between the web and mobile applications.",
        tags: ["bug", "technical", "integration"],
        priority: "high",
        category: "product"
    },
    {
        title: "Report Export Formatting",
        description: "PDF exports are not maintaining proper formatting for complex tables.",
        tags: ["bug", "feature"],
        priority: "medium",
        category: "product"
    },
    {
        title: "Data Visualization Enhancement",
        description: "Request for additional chart types in analytics dashboard.",
        tags: ["feature", "enhancement", "ui"],
        priority: "medium",
        category: "product"
    },
    {
        title: "Batch Processing Feature",
        description: "Need ability to process multiple files simultaneously.",
        tags: ["feature", "performance", "enhancement"],
        priority: "medium",
        category: "product"
    },
    {
        title: "API Rate Limiting Implementation",
        description: "Implement configurable rate limiting for API endpoints.",
        tags: ["feature", "api", "technical"],
        priority: "high",
        category: "product"
    },

    // General Inquiry Tickets
    {
        title: "Billing Cycle Question",
        description: "Need clarification on the billing cycle and when charges are applied.",
        tags: ["billing", "account"],
        priority: "low",
        category: "general"
    },
    {
        title: "Account Access for Team",
        description: "How do I set up access for my team members with different permission levels?",
        tags: ["account", "access"],
        priority: "medium",
        category: "general"
    },
    {
        title: "Training Resources Request",
        description: "Looking for training materials or documentation for new team members.",
        tags: ["account", "enhancement"],
        priority: "low",
        category: "general"
    },
    {
        title: "Subscription Upgrade Process",
        description: "Need information about upgrading our current subscription plan.",
        tags: ["billing", "account"],
        priority: "medium",
        category: "general"
    },
    {
        title: "Data Export Guidelines",
        description: "What is the process for exporting all our data for compliance purposes?",
        tags: ["account", "technical"],
        priority: "medium",
        category: "general"
    },
    {
        title: "Integration Documentation",
        description: "Request for detailed documentation on third-party integrations.",
        tags: ["account", "technical", "enhancement"],
        priority: "low",
        category: "general"
    },
    {
        title: "Custom Domain Setup",
        description: "Need help setting up custom domain for our instance.",
        tags: ["account", "technical"],
        priority: "medium",
        category: "general"
    },
    {
        title: "Compliance Requirements",
        description: "Questions about GDPR compliance and data handling procedures.",
        tags: ["account", "technical", "security"],
        priority: "high",
        category: "general"
    },
    {
        title: "Backup Strategy Review",
        description: "Need to review and possibly update our backup procedures.",
        tags: ["account", "technical", "security"],
        priority: "medium",
        category: "general"
    }
] as const;

// Predefined tags with colors
const tagsData = [
    { name: "bug", color: "#E53E3E" },
    { name: "feature", color: "#38A169" },
    { name: "ui", color: "#805AD5" },
    { name: "api", color: "#3182CE" },
    { name: "technical", color: "#718096" },
    { name: "billing", color: "#D69E2E" },
    { name: "urgent", color: "#E53E3E" },
    { name: "enhancement", color: "#38A169" },
    { name: "performance", color: "#DD6B20" },
    { name: "optimization", color: "#319795" },
    { name: "integration", color: "#3182CE" },
    { name: "account", color: "#718096" },
    { name: "access", color: "#D69E2E" }
] as const;

async function createTags() {
    console.log('Creating tags...');
    const tagMap = new Map<string, string>();
    
    try {
        // Get existing tags
        const { data: existingTags, error: fetchError } = await supabaseServiceRole
            .from('tags')
            .select('id, name');

        if (fetchError) {
            console.error('Error fetching existing tags:', fetchError);
            return tagMap;
        }

        // Add existing tags to the map
        for (const tag of existingTags || []) {
            tagMap.set(tag.name, tag.id);
        }

        // Filter out existing tags
        const existingTagNames = new Set(existingTags?.map(t => t.name) || []);
        const newTags = tagsData.filter(t => !existingTagNames.has(t.name));

        if (newTags.length > 0) {
            const { data: createdTags, error } = await supabaseServiceRole
                .from('tags')
                .insert(newTags)
                .select('id, name');

            if (error) {
                console.error('Error creating tags:', error);
            } else {
                console.log(`Created ${newTags.length} new tags`);
                // Add new tags to the map
                for (const tag of createdTags || []) {
                    tagMap.set(tag.name, tag.id);
                }
            }
        } else {
            console.log('No new tags to create');
        }
    } catch (error) {
        console.error('Error in createTags:', error);
    }

    return tagMap;
}

async function createTickets(tagMap: Map<string, string>) {
    console.log('Creating tickets...');
    try {
        // Get regular users (not agents or admins)
        const { data: users, error: usersError } = await supabaseServiceRole
            .from('profiles')
            .select('id')
            .eq('role', 'user')
            .eq('is_active', true);

        if (usersError || !users || users.length === 0) {
            console.error('Error fetching users:', usersError);
            return;
        }

        // Get agents
        const { data: agents, error: agentsError } = await supabaseServiceRole
            .from('profiles')
            .select('id')
            .eq('role', 'agent')
            .eq('is_active', true);

        if (agentsError || !agents || agents.length === 0) {
            console.error('Error fetching agents:', agentsError);
            return;
        }

        // Group tickets by category
        const ticketsByCategory = ticketTemplates.reduce((acc, ticket) => {
            if (!acc[ticket.category]) {
                acc[ticket.category] = [];
            }
            acc[ticket.category].push(ticket);
            return acc;
        }, {} as Record<string, typeof ticketTemplates[number][]>);

        // Create tickets for each category, distributing them among users
        for (const category in ticketsByCategory) {
            console.log(`\nCreating ${category} tickets...`);
            const categoryTickets = ticketsByCategory[category];
            
            for (let i = 0; i < categoryTickets.length; i++) {
                const template = categoryTickets[i];
                const user = users[i % users.length];
                const agent = agents[Math.floor(Math.random() * agents.length)];
                const timestamp = new Date();

                // Enhanced metadata with status tracking and security classification
                const metadata: TicketMetadata = {
                    current_state: {
                        name: 'open',
                        entered_at: timestamp,
                        updated_by: agent.id
                    },
                    state_transitions: [{
                        from_state: 'none',
                        to_state: 'open',
                        timestamp: timestamp,
                        user_id: agent.id
                    }],
                    status_history: [{
                        status: 'open',
                        timestamp: timestamp,
                        user_id: agent.id
                    }],
                    last_updated_by: agent.id,
                    source: 'web',
                    sla_level: template.priority === 'urgent' ? 'high' : 
                              template.priority === 'high' ? 'medium' : 'standard'
                };

                // Add security classification for security-related tickets
                if (template.tags.includes('security')) {
                    metadata.security_level = template.priority === 'urgent' ? 'critical' :
                                           template.priority === 'high' ? 'high' : 'medium';
                    metadata.security_classification = template.tags.includes('vulnerability') ? 'vulnerability' :
                                                    template.tags.includes('compliance') ? 'compliance' : 'general';
                }

                // Create the ticket with enhanced metadata
                const { data: ticket, error: ticketError } = await supabaseServiceRole
                    .from('tickets')
                    .insert({
                        title: template.title,
                        description: template.description,
                        status: 'open',
                        priority: template.priority,
                        user_id: user.id,
                        assigned_to: agent.id,
                        metadata
                    })
                    .select()
                    .single();

                if (ticketError) {
                    console.error(`Error creating ticket "${template.title}":`, ticketError);
                    continue;
                }

                // Add tags to the ticket
                for (const tagName of template.tags) {
                    const tagId = tagMap.get(tagName);
                    if (!tagId) continue;

                    const { error: tagError } = await supabaseServiceRole
                        .from('ticket_tags')
                        .insert({
                            ticket_id: ticket.id,
                            tag_id: tagId
                        });

                    if (tagError && tagError.code !== '23505') { // Ignore unique constraint violations
                        console.error(`Error adding tag "${tagName}" to ticket:`, tagError);
                    }
                }

                console.log(`Created ticket: ${template.title}`);
            }
        }
    } catch (error) {
        console.error('Error in createTickets:', error);
    }
}

async function main() {
    try {
        const tagMap = await createTags();
        await createTickets(tagMap);
        console.log('Test data generation completed successfully');
    } catch (error) {
        console.error('Error in main:', error);
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0)); 