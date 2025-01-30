import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = resolve(__dirname, '..', '.env');
config({ path: envPath });

if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.VITE_OPENAI_API_KEY) {
    console.error('Missing required environment variables');
    process.exit(1);
}

// Initialize Supabase client
const client = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings();

// Add type definitions at the top of the file
interface Skill {
    name: string;
    category: string;
}

interface UserSkill {
    proficiency_level: string;
    skills: Skill;
}

interface Profile {
    full_name: string;
    email: string;
}

interface TeamMember {
    user_id: string;
    is_team_lead: boolean;
    profiles: Profile;
    user_skills: UserSkill[];
}

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

interface Ticket {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    metadata: TicketMetadata;
}

async function deleteExistingEmbeddings() {
    console.log('Deleting existing embeddings...');
    const { error } = await client
        .from('ai_documents')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (error) {
        console.error('Error deleting existing embeddings:', error);
    } else {
        console.log('Successfully deleted existing embeddings');
    }
}

async function generateEmbeddings() {
    console.log('Starting test data embedding generation...');

    try {
        // Delete existing embeddings first
        await deleteExistingEmbeddings();

        // Process KB Articles
        console.log('\nProcessing KB Articles...');
        const { data: articles, error: articlesError } = await client
            .from('kb_articles')
            .select('id, title, content')
            .eq('deleted', false);

        if (articlesError) {
            console.error('Error fetching KB articles:', articlesError);
        } else {
            for (const article of articles || []) {
                const embedding = await embeddings.embedQuery(article.content);
                const { error } = await client
                    .from('ai_documents')
                    .upsert({
                        content: article.content,
                        metadata: { 
                            title: article.title,
                            document_type: 'kb_article'
                        },
                        embedding,
                        document_type: 'kb_article',
                        reference_id: article.id,
                        title: article.title
                    });

                if (error) {
                    console.error(`Error storing KB article embedding (${article.id}):`, error);
                } else {
                    console.log(`Generated embedding for KB article: ${article.title}`);
                }
            }
        }

        // Process Tickets
        console.log('\nProcessing Tickets...');
        const { data: tickets, error: ticketsError } = await client
            .from('tickets')
            .select('id, title, description, status, priority, metadata')
            .eq('deleted', false);

        if (ticketsError) {
            console.error('Error fetching tickets:', ticketsError);
        } else {
            for (const ticket of tickets || []) {
                // Create a rich content string that includes metadata
                const metadataString = ticket.metadata ? `
Current State: ${ticket.metadata.current_state.name}
SLA Level: ${ticket.metadata.sla_level}
${ticket.metadata.security_level ? `Security Level: ${ticket.metadata.security_level}` : ''}
${ticket.metadata.security_classification ? `Security Classification: ${ticket.metadata.security_classification}` : ''}
Source: ${ticket.metadata.source}

Status History:
${ticket.metadata.status_history.map((sh: { status: string; timestamp: Date | string }) => 
    `- ${sh.status} (${new Date(sh.timestamp).toISOString()})`
).join('\n')}
` : '';

                const fullContent = `${ticket.description || ''}

Ticket Information:
Status: ${ticket.status}
Priority: ${ticket.priority}
${metadataString}`;

                const embedding = await embeddings.embedQuery(fullContent);
                const { error } = await client
                    .from('ai_documents')
                    .upsert({
                        content: fullContent,
                        metadata: {
                            status: ticket.status,
                            priority: ticket.priority,
                            document_type: 'ticket',
                            current_state: ticket.metadata?.current_state,
                            sla_level: ticket.metadata?.sla_level,
                            security_level: ticket.metadata?.security_level,
                            security_classification: ticket.metadata?.security_classification
                        },
                        embedding,
                        document_type: 'ticket',
                        reference_id: ticket.id,
                        title: ticket.title
                    });

                if (error) {
                    console.error(`Error storing ticket embedding (${ticket.id}):`, error);
                } else {
                    console.log(`Generated embedding for ticket: ${ticket.title}`);
                }
            }
        }

        // Process Teams
        console.log('\nProcessing Teams...');
        const { data: teams, error: teamsError } = await client
            .from('teams')
            .select('id, name, description')
            .eq('deleted', false);

        if (teamsError) {
            console.error('Error fetching teams:', teamsError);
        } else {
            for (const team of teams || []) {
                // Get team members and their skills
                const { data: members } = await client
                    .from('team_members')
                    .select(`
                        user_id,
                        is_team_lead,
                        profiles (
                            full_name,
                            email
                        ),
                        user_skills (
                            proficiency_level,
                            skills (
                                name,
                                category
                            )
                        )
                    `)
                    .eq('team_id', team.id) as { data: TeamMember[] | null };

                // Format team member information
                const memberInfo = members?.map(member => {
                    const skills = member.user_skills?.map(us => 
                        `${us.skills.name} (${us.proficiency_level})`
                    ).join(', ') || 'No specific skills listed';

                    return `${member.is_team_lead ? 'Team Lead' : 'Member'}: ${member.profiles.full_name}
Skills: ${skills}`;
                }).join('\n') || 'No team members listed';

                // Combine team description with member information
                const fullContent = `${team.description || ''}
                
Team Members:
${memberInfo}`;

                const embedding = await embeddings.embedQuery(fullContent);
                const { error } = await client
                    .from('ai_documents')
                    .upsert({
                        content: fullContent,
                        metadata: { 
                            name: team.name,
                            document_type: 'team'
                        },
                        embedding,
                        document_type: 'team',
                        reference_id: team.id,
                        title: team.name
                    });

                if (error) {
                    console.error(`Error storing team embedding (${team.id}):`, error);
                } else {
                    console.log(`Generated embedding for team: ${team.name}`);
                }
            }
        }

        console.log('\nEmbedding generation completed');

    } catch (error) {
        console.error('Error during embedding generation:', error);
    }
}

generateEmbeddings().catch(console.error); 