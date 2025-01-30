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

// Test Skills Data
const skillsData = [
    {
        name: "Technical Support",
        description: "General technical support and troubleshooting",
        category: "technical",
        is_active: true
    },
    {
        name: "Customer Service",
        description: "Customer service and communication skills",
        category: "soft_skill",
        is_active: true
    },
    {
        name: "Product Knowledge",
        description: "Understanding of product features and capabilities",
        category: "product",
        is_active: true
    },
    {
        name: "Problem Solving",
        description: "Analytical and problem-solving abilities",
        category: "soft_skill",
        is_active: true
    },
    {
        name: "Documentation",
        description: "Technical writing and documentation",
        category: "technical",
        is_active: true
    }
] as const;

// Test Teams Data
const teamsData = [
    {
        name: 'Technical Support Team',
        description: 'Handles technical support tickets and issues',
        is_active: true
    },
    {
        name: 'Customer Success Team',
        description: 'Manages customer relationships and success',
        is_active: true
    },
    {
        name: 'Product Support Team',
        description: 'Provides product-specific support',
        is_active: true
    }
] as const;

async function createSkills(): Promise<Map<string, string>> {
    console.log('Creating skills...');
    const skillMap = new Map<string, string>();
    
    try {
        // Get existing skills
        const { data: existingSkills, error: fetchError } = await supabaseServiceRole
            .from('skills')
            .select('id, name');

        if (fetchError) {
            console.error('Error fetching existing skills:', fetchError);
            return skillMap;
        }

        // Add existing skills to the map
        for (const skill of existingSkills || []) {
            skillMap.set(skill.name, skill.id);
        }

        // Filter out existing skills
        const existingSkillNames = new Set(existingSkills?.map(s => s.name) || []);
        const newSkills = skillsData.filter(s => !existingSkillNames.has(s.name));

        if (newSkills.length > 0) {
            const { data: createdSkills, error } = await supabaseServiceRole
                .from('skills')
                .insert(newSkills)
                .select('id, name');

            if (error) {
                console.error('Error creating skills:', error);
            } else {
                console.log(`Created ${newSkills.length} new skills`);
                // Add new skills to the map
                for (const skill of createdSkills || []) {
                    skillMap.set(skill.name, skill.id);
                }
            }
        } else {
            console.log('No new skills to create');
        }
    } catch (error) {
        console.error('Error in createSkills:', error);
    }

    return skillMap;
}

async function createTeams() {
    console.log('Creating teams...');
    try {
        // Get existing teams
        const { data: existingTeams, error: fetchError } = await supabaseServiceRole
            .from('teams')
            .select('name');

        if (fetchError) {
            console.error('Error fetching existing teams:', fetchError);
            return;
        }

        // Filter out existing teams
        const existingTeamNames = new Set(existingTeams?.map(t => t.name) || []);
        const newTeams = teamsData.filter(t => !existingTeamNames.has(t.name));

        if (newTeams.length > 0) {
            const { error } = await supabaseServiceRole
                .from('teams')
                .insert(newTeams);

            if (error) {
                console.error('Error creating teams:', error);
            } else {
                console.log(`Created ${newTeams.length} new teams`);
            }
        } else {
            console.log('No new teams to create');
        }
    } catch (error) {
        console.error('Error in createTeams:', error);
    }
}

async function assignAgentsToTeams() {
    console.log('Assigning agents to teams...');
    try {
        // Get all teams
        const { data: teams, error: teamsError } = await supabaseServiceRole
            .from('teams')
            .select('id, name')
            .eq('is_active', true);

        if (teamsError || !teams) {
            console.error('Error fetching teams:', teamsError);
            return;
        }

        // Get only agents (excluding admins)
        const { data: agents, error: agentsError } = await supabaseServiceRole
            .from('profiles')
            .select('id, role')
            .eq('role', 'agent')
            .eq('is_active', true);

        if (agentsError || !agents) {
            console.error('Error fetching agents:', agentsError);
            return;
        }

        // Assign agents to teams
        for (const team of teams) {
            // Randomly select 2-4 agents for each team
            const numAgents = Math.floor(Math.random() * 3) + 2; // 2-4 agents
            const shuffledAgents = agents
                .sort(() => Math.random() - 0.5)
                .slice(0, numAgents);

            for (const agent of shuffledAgents) {
                const { error: memberError } = await supabaseServiceRole
                    .from('team_members')
                    .insert({
                        team_id: team.id,
                        user_id: agent.id,
                        is_team_lead: Math.random() < 0.3 // 30% chance of being team lead
                    })
                    .select()
                    .single();

                if (memberError && memberError.code !== '23505') { // Ignore unique constraint violations
                    console.error(`Error adding agent to team ${team.name}:`, memberError);
                }
            }

            console.log(`Assigned ${numAgents} agents to team: ${team.name}`);
        }
    } catch (error) {
        console.error('Error in assignAgentsToTeams:', error);
    }
}

async function createTeamSchedules() {
    console.log('Creating team schedules...');
    try {
        // Get all team members
        const { data: teamMembers, error: membersError } = await supabaseServiceRole
            .from('team_members')
            .select('team_id, user_id');

        if (membersError) {
            console.error('Error fetching team members:', membersError);
            return;
        }

        // Create schedules for each team member
        for (const member of teamMembers || []) {
            // Create weekday schedule (Monday-Friday)
            for (let day = 1; day <= 5; day++) {
                const { error: scheduleError } = await supabaseServiceRole
                    .from('team_schedules')
                    .insert({
                        team_id: member.team_id,
                        user_id: member.user_id,
                        day_of_week: day,
                        start_time: '09:00:00',
                        end_time: '17:00:00',
                        is_active: true
                    })
                    .select()
                    .single();

                if (scheduleError && scheduleError.code !== '23505') { // Ignore unique constraint violations
                    console.error('Error creating weekday schedule:', scheduleError);
                }
            }

            // Randomly assign weekend on-call (20% chance)
            if (Math.random() < 0.2) {
                for (let day of [0, 6]) { // Sunday and Saturday
                    const { error: scheduleError } = await supabaseServiceRole
                        .from('team_schedules')
                        .insert({
                            team_id: member.team_id,
                            user_id: member.user_id,
                            day_of_week: day,
                            start_time: '10:00:00',
                            end_time: '16:00:00',
                            is_active: true
                        })
                        .select()
                        .single();

                    if (scheduleError && scheduleError.code !== '23505') { // Ignore unique constraint violations
                        console.error('Error creating weekend schedule:', scheduleError);
                    }
                }
            }
        }
        console.log('Team schedules created successfully');
    } catch (error) {
        console.error('Error in createTeamSchedules:', error);
    }
}

async function main() {
    try {
        const skillMap = await createSkills();
        await createTeams();
        await assignAgentsToTeams();
        await createTeamSchedules();
        console.log('Test data generation completed successfully');
    } catch (error) {
        console.error('Error in main:', error);
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0)); 