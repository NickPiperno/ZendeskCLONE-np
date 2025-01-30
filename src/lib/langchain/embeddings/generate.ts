import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
const envPath = resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);
const result = config({ path: envPath });

// Function to decode JWT without verification
function decodeJWT(token: string) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload;
    } catch (e) {
        console.error('Error decoding JWT:', e);
        return null;
    }
}

// Debug environment loading
console.log('\nEnvironment Variables Debug:');
console.log('1. Dotenv parsed result:', result.parsed ? 'Success' : 'Failed');
console.log('2. All env keys:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));

// Decode and verify service role key
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if (serviceKey) {
    const decodedToken = decodeJWT(serviceKey);
    console.log('\nService Key JWT Claims:', decodedToken);
    if (decodedToken?.role !== 'service_role') {
        throw new Error('Invalid service role key - wrong role claim');
    }
    console.log('Service key role verification:', decodedToken.role === 'service_role' ? 'PASSED' : 'FAILED');
} else {
    console.log('No service key found');
}

// Test service role access
const testClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

console.log('\nTesting database access...');

// Try accessing different tables and views with column info
const tables = [
    { name: 'profiles', columns: 'id, email, role' },
    { name: 'tickets', columns: 'id, title, status' },
    { name: 'kb_articles', columns: 'id, title' },
    { name: 'teams', columns: 'id, name' },
    { name: 'ai_documents', columns: 'id, document_type' }
];

for (const table of tables) {
    console.log(`\nTrying to access table: ${table.name}`);
    
    // Try SELECT
    const { data: selectData, error: selectError } = await testClient
        .from(table.name)
        .select(table.columns)
        .limit(1);
    console.log('SELECT:', selectError ? 
        `Error: ${selectError.message} (Code: ${selectError.code})` : 
        `Success! Found ${selectData?.length || 0} rows`
    );
    
    // Try INSERT (with immediate DELETE to avoid data pollution)
    if (!selectError) {
        console.log('Checking write permissions...');
        const testId = 'test_' + Date.now();
        const { error: insertError } = await testClient
            .from(table.name)
            .insert({ id: testId })
            .select('id')
            .single();
        
        console.log('INSERT:', insertError ?
            `Error: ${insertError.message} (Code: ${insertError.code})` :
            'Success!'
        );

        // Clean up test data if insert succeeded
        if (!insertError) {
            await testClient
                .from(table.name)
                .delete()
                .eq('id', testId);
        }
    }
}

// Try a raw count query
console.log('\nTrying to count tables...');
const { error: countError, count } = await testClient
    .from('kb_articles')
    .select('*', { count: 'exact', head: true });

console.log('Count query:', countError ? 
    `Error: ${countError.message}` :
    `Success! Count: ${count || 0}`
);

import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import { Database, DocumentType, TicketStatus, TicketPriority } from "../../../types/supabase";

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings();

// Initialize Supabase client with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('\nSupabase Configuration:');
console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey);

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials. Make sure SUPABASE_SERVICE_KEY is set in .env');
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

// Configuration constants
const MAX_RETRIES = 3;
const INITIAL_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;
const BACKOFF_DELAY = 1000; // 1 second

interface ProcessingStats {
    total: number;
    processed: number;
    success: number;
    failed: number;
    startTime: number;
    batchSize: number;
    retries: number;
}

interface EmbeddingJob {
    content: string;
    metadata: Record<string, any>;
    document_type: DocumentType;
    reference_id: string;
    title?: string;
}

interface TicketTagSummary {
    tag_names: string[];
    tag_colors: string[];
    tag_ids: string[];
}

interface TeamMemberProfile {
    full_name: string;
    email: string;
}

interface TeamData {
    id: string;
    name: string;
    description: string | null;
    team_members: Array<{
        user_id: string;
        is_team_lead: boolean;
        profiles: TeamMemberProfile;
        user_skills: Array<{
            proficiency_level: string;
            skill_id: string;
            skills: {
                name: string;
                category: string;
            }
        }>;
    }>;
}

// Process a batch of documents
async function processBatch(jobs: EmbeddingJob[]): Promise<{ success: number; failed: number }> {
    const results = { success: 0, failed: 0 };
    
    try {
        // Generate embeddings for all texts in batch
        const texts = jobs.map(job => job.content);
        const embeddingVectors = await embeddings.embedDocuments(texts);

        // Process each document with its embedding
        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            const embedding = embeddingVectors[i];

            try {
                const { error } = await supabase
                    .from('ai_documents')
                    .upsert({
                        content: job.content,
                        metadata: job.metadata,
                        embedding,
                        document_type: job.document_type,
                        reference_id: job.reference_id,
                        title: job.title
                    });

                if (error) {
                    console.error(`Failed to store embedding for ${job.document_type}:${job.reference_id}`, error);
                    results.failed++;
                } else {
                    results.success++;
                }
            } catch (err) {
                console.error(`Error processing document ${job.document_type}:${job.reference_id}`, err);
                results.failed++;
            }
        }
    } catch (err) {
        console.error('Error generating embeddings for batch:', err);
        results.failed += jobs.length;
    }

    return results;
}

// Process KB articles
async function processKBArticles(limit?: number): Promise<EmbeddingJob[]> {
    const { data: articles, error } = await supabase
        .from('kb_articles')
        .select('id, title, content, category_id, author_id, is_published')
        .filter('deleted', 'eq', false)
        .limit(limit || 1000); // Increased from 100

    if (error) {
        console.error('Error fetching KB articles:', error);
        return [];
    }

    console.log(`Found ${articles.length} KB articles to process`);
    return articles.map(article => ({
        content: article.content,
        metadata: {
            category_id: article.category_id,
            author_id: article.author_id,
            is_published: article.is_published
        },
        document_type: 'kb_article',
        reference_id: article.id,
        title: article.title
    }));
}

// Process tickets
async function processTickets(limit?: number): Promise<EmbeddingJob[]> {
    // First get the tickets with their basic info
    const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
            id, 
            title, 
            description, 
            status, 
            priority, 
            user_id, 
            assigned_to, 
            metadata
        `)
        .filter('deleted', 'eq', false)
        .limit(limit || 1000); // Increased from 100

    if (error) {
        console.error('Error fetching tickets:', error);
        return [];
    }

    console.log(`Found ${tickets.length} tickets to process`);

    // Get tag information for each ticket
    const ticketIds = tickets.map(t => t.id);
    const { data: tagSummaries, error: tagError } = await supabase
        .from('ticket_tag_summaries')
        .select('*')
        .in('ticket_id', ticketIds);

    if (tagError) {
        console.error('Error fetching tag summaries:', tagError);
    }

    console.log(`Found ${tagSummaries?.length || 0} ticket tags to process`);

    // Create a map of ticket ID to tags
    const tagMap = new Map<string, TicketTagSummary>();
    tagSummaries?.forEach(summary => {
        tagMap.set(summary.ticket_id, {
            tag_names: summary.tag_names,
            tag_colors: summary.tag_colors,
            tag_ids: summary.tag_ids
        });
    });

    return tickets.map(ticket => {
        // Get tags from the map
        const tagSummary = tagMap.get(ticket.id);
        const tags = tagSummary?.tag_names || [];
        const tagIds = tagSummary?.tag_ids || [];
        
        // Add tags to the content for better semantic search
        const tagContent = tags.length > 0 ? `\nTags: ${tags.join(', ')}` : '';
        
        return {
            content: `${ticket.description || ''}${tagContent}`,
            metadata: {
                status: ticket.status as TicketStatus,
                priority: ticket.priority as TicketPriority,
                user_id: ticket.user_id,
                assigned_to: ticket.assigned_to,
                tags: tags,
                tag_ids: tagIds,
                ...ticket.metadata
            },
            document_type: 'ticket',
            reference_id: ticket.id,
            title: ticket.title
        };
    });
}

// Process teams
async function processTeams(limit?: number): Promise<EmbeddingJob[]> {
    const { data, error } = await supabase
        .from('teams')
        .select(`
            id,
            name,
            description,
            team_members!inner (
                user_id,
                is_team_lead
            )
        `)
        .limit(limit || 1000);

    if (error) {
        console.error('Error fetching teams:', error);
        return [];
    }

    const teams = data as TeamData[];
    console.log(`Found ${teams.length} teams to process`);

    // Get all unique user IDs from team members
    const userIds = [...new Set(teams.flatMap(team => 
        team.team_members.map(member => member.user_id)
    ))];

    console.log(`Found ${userIds.length} unique team members to process`);

    // Fetch profiles for all users
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

    if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return [];
    }

    console.log(`Found ${profiles?.length || 0} user profiles`);

    // Create a map of user_id to profile
    const profileMap = new Map(profiles?.map(profile => [profile.id, profile]));

    // Fetch skills for all users
    const { data: userSkills, error: skillsError } = await supabase
        .from('user_skills')
        .select(`
            user_id,
            proficiency_level,
            skill_id,
            skills!inner (
                name,
                category
            )
        `)
        .in('user_id', userIds);

    if (skillsError) {
        console.error('Error fetching user skills:', skillsError);
        return [];
    }

    console.log(`Found ${userSkills?.length || 0} user skills`);

    interface UserSkill {
        proficiency_level: string;
        name: string;
        category: string;
    }

    interface SkillData {
        user_id: string;
        proficiency_level: string;
        skill_id: string;
        skills: {
            name: string;
            category: string;
        };
    }

    // Create a map of user_id to skills
    const skillsMap = new Map<string, UserSkill[]>();
    ((userSkills as unknown) as SkillData[])?.forEach(skill => {
        const userSkills = skillsMap.get(skill.user_id) || [];
        userSkills.push({
            proficiency_level: skill.proficiency_level,
            name: skill.skills.name,
            category: skill.skills.category
        });
        skillsMap.set(skill.user_id, userSkills);
    });

    // Process teams with member data
    return teams.map(team => ({
        content: `${team.name}\n${team.description || ''}`,
        metadata: {
            team_id: team.id,
            members: team.team_members.map(member => {
                const profile = profileMap.get(member.user_id);
                const skills = skillsMap.get(member.user_id) || [];
                return {
                    user_id: member.user_id,
                    is_lead: member.is_team_lead,
                    name: profile?.full_name || 'Unknown',
                    email: profile?.email || '',
                    skills: skills
                };
            })
        },
        document_type: 'team',
        reference_id: team.id,
        title: team.name
    }));
}

// Enhanced batch processing with automatic batch size adjustment
async function processBatchWithRetry(
    jobs: EmbeddingJob[],
    stats: ProcessingStats
): Promise<{ success: number; failed: number }> {
    let retries = 0;
    let delay = BACKOFF_DELAY;

    while (retries < MAX_RETRIES) {
        try {
            const results = await processBatch(jobs);
            
            // If successful, consider increasing batch size
            if (results.failed === 0 && stats.batchSize < MAX_BATCH_SIZE) {
                stats.batchSize = Math.min(stats.batchSize * 1.5, MAX_BATCH_SIZE);
            }
            
            return results;
        } catch (error) {
            retries++;
            stats.retries++;
            console.error(`Batch processing failed (attempt ${retries}/${MAX_RETRIES}):`, error);
            
            // Reduce batch size on failure
            stats.batchSize = Math.max(Math.floor(stats.batchSize * 0.5), INITIAL_BATCH_SIZE);
            
            if (retries < MAX_RETRIES) {
                console.log(`Retrying in ${delay}ms with batch size ${stats.batchSize}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }
    
    console.error('Max retries exceeded for batch');
    return { success: 0, failed: jobs.length };
}

// Enhanced batch processor with progress tracking and performance metrics
async function processInBatches(jobs: EmbeddingJob[]) {
    const stats: ProcessingStats = {
        total: jobs.length,
        processed: 0,
        success: 0,
        failed: 0,
        startTime: Date.now(),
        batchSize: INITIAL_BATCH_SIZE,
        retries: 0
    };

    console.log(`\nStarting processing of ${stats.total} documents...`);
    console.log(`Initial batch size: ${stats.batchSize}`);
    console.log(`Maximum batch size: ${MAX_BATCH_SIZE}`);

    let lastProgressUpdate = Date.now();
    const PROGRESS_UPDATE_INTERVAL = 5000; // 5 seconds

    for (let i = 0; i < jobs.length; i += stats.batchSize) {
        const batch = jobs.slice(i, i + stats.batchSize);
        const results = await processBatchWithRetry(batch, stats);
        
        stats.processed += batch.length;
        stats.success += results.success;
        stats.failed += results.failed;

        // Calculate progress and performance metrics
        const progress = (stats.processed / stats.total * 100).toFixed(1);
        const elapsedSeconds = (Date.now() - stats.startTime) / 1000;
        const docsPerSecond = (stats.processed / elapsedSeconds).toFixed(2);
        const estimatedTimeRemaining = ((stats.total - stats.processed) / parseFloat(docsPerSecond)).toFixed(1);
        
        // Only update progress every 5 seconds or on completion
        const now = Date.now();
        if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL || i + stats.batchSize >= jobs.length) {
            console.log(
                `Progress: ${progress}% (${stats.processed}/${stats.total}) | ` +
                `Success: ${stats.success} | Failed: ${stats.failed} | ` +
                `Batch Size: ${stats.batchSize} | ` +
                `Speed: ${docsPerSecond} docs/sec | ` +
                `Est. Time Remaining: ${estimatedTimeRemaining}s | ` +
                `Retries: ${stats.retries}`
            );
            lastProgressUpdate = now;
        }

        // Add memory usage metrics
        if (i % (stats.batchSize * 5) === 0) { // Every 5 batches
            const used = process.memoryUsage();
            console.log('\nMemory Usage:');
            console.log(`Heap Used: ${(used.heapUsed / 1024 / 1024).toFixed(1)} MB`);
            console.log(`Heap Total: ${(used.heapTotal / 1024 / 1024).toFixed(1)} MB`);
            console.log(`RSS: ${(used.rss / 1024 / 1024).toFixed(1)} MB\n`);
        }
    }

    // Final summary with performance metrics
    const totalTime = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const avgSpeed = (stats.total / parseFloat(totalTime)).toFixed(2);
    const successRate = ((stats.success / stats.total) * 100).toFixed(1);
    
    console.log(
        `\nProcessing complete in ${totalTime}s:\n` +
        `Total: ${stats.total} | Success: ${stats.success} | ` +
        `Failed: ${stats.failed} | Retries: ${stats.retries}\n` +
        `Average Speed: ${avgSpeed} docs/sec | Success Rate: ${successRate}%`
    );

    return stats;
}

// Add delete function before test embeddings
async function deleteExistingEmbeddings() {
    console.log('\nDeleting existing embeddings...');
    const { error } = await supabase
        .from('ai_documents')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

    if (error) {
        console.error('Error deleting existing embeddings:', error);
    } else {
        console.log('Successfully deleted existing embeddings');
    }
}

// Update testEmbeddings function to delete first
export async function testEmbeddings() {
    console.log('Starting test embedding generation...');
    
    // Delete existing embeddings first
    await deleteExistingEmbeddings();
    
    // Process a small batch of KB articles
    console.log('\nProcessing test KB articles...');
    const kbResults = await processKBArticles(3);
    console.log('KB Articles results:', kbResults);
    
    // Process a larger batch of tickets
    console.log('\nProcessing test tickets...');
    const ticketResults = await processTickets(5);
    console.log('Tickets results:', ticketResults);
    
    // Process a small batch of teams
    console.log('\nProcessing test teams...');
    const teamResults = await processTeams(3);
    console.log('Teams results:', teamResults);
    
    // Verify embeddings were stored
    console.log('\nVerifying stored embeddings...');
    const { data: storedDocs, error } = await supabase
        .from('ai_documents')
        .select('id, document_type, embedding')
        .order('created_at', { ascending: false })
        .limit(11); // Updated to account for 5 tickets + 3 KB articles + 3 teams
        
    if (error) {
        console.error('Error verifying stored embeddings:', error);
        return false;
    }

    // Log a sample embedding for debugging
    if (storedDocs && storedDocs.length > 0) {
        console.log('Sample embedding type:', typeof storedDocs[0].embedding);
        console.log('Sample embedding structure:', storedDocs[0].embedding.slice(0, 100) + '...');
    }
    
    // Check if embeddings exist and are valid vectors
    const validEmbeddings = storedDocs?.every(doc => {
        if (!doc.embedding || typeof doc.embedding !== 'string') return false;
        try {
            // Parse the vector string and check its length
            const vector = JSON.parse(doc.embedding);
            return Array.isArray(vector) && vector.length === 1536;
        } catch {
            return false;
        }
    });
    
    console.log(`Found ${storedDocs?.length || 0} recently stored documents`);
    console.log('Embeddings validation:', validEmbeddings ? 'PASSED' : 'FAILED');
    
    return validEmbeddings;
}

// Validation function to check embedding quality
async function validateEmbeddings(documentType: DocumentType): Promise<boolean> {
    console.log(`\nValidating ${documentType} embeddings...`);
    
    const { data: samples, error } = await supabase
        .from('ai_documents')
        .select('id, content, embedding')
        .eq('document_type', documentType)
        .limit(5);
    
    if (error || !samples?.length) {
        console.error('Validation failed - could not fetch samples:', error);
        return false;
    }

    try {
        // Parse the embedding string into an array
        const firstEmbedding = JSON.parse(samples[0].embedding);
        
        // Check embedding dimensions
        const dimensions = firstEmbedding.length;
        const validDimensions = dimensions === 1536; // OpenAI embedding size
        
        if (!validDimensions) {
            console.error(`Invalid embedding dimensions: ${dimensions} (expected 1536)`);
            return false;
        }

        // Check for null values in all samples
        const hasNullValues = samples.some(sample => {
            const embedding = JSON.parse(sample.embedding);
            return !embedding || embedding.some((val: number) => val === null);
        });
        
        if (hasNullValues) {
            console.error('Found null values in embeddings');
            return false;
        }

        console.log(`✓ ${documentType} embeddings validated successfully`);
        return true;
    } catch (err) {
        console.error('Error parsing embeddings:', err);
        return false;
    }
}

// Enhanced main generation function
export async function generateAllEmbeddings() {
    console.log('Starting full embedding generation...');
    
    // Delete existing embeddings first
    await deleteExistingEmbeddings();
    
    // Process each document type
    const documentTypes = ['kb_article', 'ticket', 'team'] as const;
    const results: Record<string, ProcessingStats> = {};
    
    for (const type of documentTypes) {
        console.log(`\nProcessing ${type} documents...`);
        
        let jobs: EmbeddingJob[] = [];
        switch (type) {
            case 'kb_article':
                jobs = await processKBArticles() || [];
                break;
            case 'ticket':
                jobs = await processTickets() || [];
                break;
            case 'team':
                jobs = await processTeams() || [];
                break;
        }
        
        if (jobs?.length) {
            results[type] = await processInBatches(jobs);
            
            // Validate the embeddings
            const isValid = await validateEmbeddings(type);
            if (!isValid) {
                console.error(`⚠️ Validation failed for ${type} embeddings`);
                throw new Error(`Embedding validation failed for ${type}`);
            }
        }
    }
    
    // Final report
    console.log('\nFinal Processing Report:');
    for (const [type, stats] of Object.entries(results)) {
        console.log(
            `\n${type}:\n` +
            `Total: ${stats.total} | Success: ${stats.success} | ` +
            `Failed: ${stats.failed} | Retries: ${stats.retries}`
        );
    }
}

// Main function to run the script
async function main() {
    const isTestMode = process.argv.includes('--test');
    
    try {
        if (isTestMode) {
            console.log('Running in test mode...');
            const testSuccess = await testEmbeddings();
            console.log('\nTest completed:', testSuccess ? 'SUCCESS' : 'FAILED');
        } else {
            await generateAllEmbeddings();
        }
    } catch (error) {
        console.error('Error in main process:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error); 