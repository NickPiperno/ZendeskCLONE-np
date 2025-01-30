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
        name: "Ticket System",
        description: "Proficiency in using and troubleshooting the ticket management system",
        category: "technical",
        is_active: true
    },
    {
        name: "Knowledge Base Management",
        description: "Ability to create, update and manage knowledge base articles",
        category: "technical",
        is_active: true
    },
    {
        name: "Technical Troubleshooting",
        description: "Ability to diagnose and resolve technical issues",
        category: "product",
        is_active: true
    },
    {
        name: "Customer Communication",
        description: "Excellent written and verbal communication with customers",
        category: "soft_skill",
        is_active: true
    },
    {
        name: "Problem Solving",
        description: "Strong analytical and problem-solving abilities",
        category: "soft_skill",
        is_active: true
    },
    {
        name: "English",
        description: "Professional business English communication",
        category: "language",
        is_active: true
    }
] as const;

// Test Teams Data
const technicalSupportTeams = [
    {
        name: 'Core Infrastructure',
        description: 'Handles core infrastructure and platform issues',
        is_active: true
    },
    {
        name: 'Application Support',
        description: 'Supports application-level technical issues',
        is_active: true
    },
    {
        name: 'Security Operations',
        description: 'Handles security-related incidents and compliance',
        is_active: true
    }
];

const productTeams = [
    {
        name: 'Product Development',
        description: 'Handles product development and feature requests',
        is_active: true
    },
    {
        name: 'Product Innovation',
        description: 'Focuses on new product features and improvements',
        is_active: true
    }
];

const specializedTeams = [
    {
        name: 'Enterprise Support',
        description: 'Dedicated support for enterprise customers',
        is_active: true
    },
    {
        name: 'Customer Success',
        description: 'Handles customer success and satisfaction',
        is_active: true
    }
];

async function createSkills(): Promise<Map<string, string>> {
    console.log('Creating skills...');
    const skillMap = new Map<string, string>();
    
    try {
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

async function assignSkillsToUsers(skillMap: Map<string, string>) {
    console.log('Assigning skills to users...')
    try {
        // Get all users with their roles
        const { data: users, error: usersError } = await supabaseServiceRole
            .from('profiles')
            .select('id, role')
            .in('role', ['agent', 'admin'])

        if (usersError || !users) {
            console.error('Error fetching users:', usersError)
            return
        }

        // Get all skills
        const { data: skills, error: skillsError } = await supabaseServiceRole
            .from('skills')
            .select('id, category')
            .eq('is_active', true)

        if (skillsError || !skills) {
            console.error('Error fetching skills:', skillsError)
            return
        }

        // Group skills by category
        const skillsByCategory = skills.reduce((acc, skill) => {
            if (!acc[skill.category]) {
                acc[skill.category] = []
            }
            acc[skill.category].push(skill.id)
            return acc
        }, {} as Record<string, string[]>)

        // Assign skills to each user
        for (const user of users) {
            // Admins get more skills than agents
            const numSkills = user.role === 'admin' ? 
                Math.floor(Math.random() * 3) + 4 : // 4-6 skills for admins
                Math.floor(Math.random() * 2) + 2   // 2-3 skills for agents

            // Select random skills from each category
            const selectedSkills = new Set<string>()
            const categories = Object.keys(skillsByCategory)

            for (let i = 0; i < numSkills; i++) {
                const category = categories[Math.floor(Math.random() * categories.length)]
                const categorySkills = skillsByCategory[category]
                if (categorySkills && categorySkills.length > 0) {
                    const skillId = categorySkills[Math.floor(Math.random() * categorySkills.length)]
                    if (!selectedSkills.has(skillId)) {
                        selectedSkills.add(skillId)
                        const { error: skillError } = await supabaseServiceRole
                            .from('user_skills')
                            .insert({
                                user_id: user.id,
                                skill_id: skillId,
                                proficiency_level: Math.floor(Math.random() * 3) + 3 // Level 3-5
                            })

                        if (skillError) {
                            console.error(`Error assigning skill to user ${user.id}:`, skillError)
                        }
                    }
                }
            }

            console.log(`Assigned ${selectedSkills.size} skills to user ${user.id}`)
        }
    } catch (error) {
        console.error('Error in assignSkillsToUsers:', error)
    }
}

async function createTeamSchedules() {
    console.log('Creating team schedules...')
    try {
        // Get all team members
        const { data: teamMembers, error: membersError } = await supabaseServiceRole
            .from('team_members')
            .select('team_id, user_id')

        if (membersError) {
            console.error('Error fetching team members:', membersError)
            return
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

                if (scheduleError) {
                    console.error('Error creating weekday schedule:', scheduleError)
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

                    if (scheduleError) {
                        console.error('Error creating weekend schedule:', scheduleError)
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in createTeamSchedules:', error)
    }
}

async function createTeams() {
    console.log('Creating Teams...')
    try {
        // First fetch existing teams
        const { data: existingTeams, error: fetchError } = await supabaseServiceRole
            .from('teams')
            .select('name')

        if (fetchError) {
            console.error('Error fetching existing teams:', fetchError)
            return
        }

        const existingTeamNames = new Set(existingTeams?.map(t => t.name) || [])
        const allTeams = [...technicalSupportTeams, ...productTeams, ...specializedTeams]
        const newTeams = allTeams.filter(t => !existingTeamNames.has(t.name))

        if (newTeams.length > 0) {
            const { error } = await supabaseServiceRole
                .from('teams')
                .insert(newTeams)

            if (error) {
                console.error('Error creating teams:', error)
            } else {
                console.log(`Created ${newTeams.length} new teams`)
            }
        } else {
            console.log('No new teams to create')
        }

        // Fetch all teams to get their IDs
        const { data: teams, error: teamsError } = await supabaseServiceRole
            .from('teams')
            .select('id, name')

        if (teamsError || !teams) {
            console.error('Error fetching teams:', teamsError)
            return
        }

        // Create a map of team names to IDs
        const teamMap = new Map(teams.map(t => [t.name, t.id]))

        // Get all users
        const { data: users, error: usersError } = await supabaseServiceRole
            .from('profiles')
            .select('id, role')
            .in('role', ['agent', 'admin'])

        if (usersError || !users) {
            console.error('Error fetching users:', usersError)
            return
        }

        // Assign users to teams
        for (const team of allTeams) {
            const teamId = teamMap.get(team.name)
            if (!teamId) {
                console.error(`Team ${team.name} not found`)
                continue
            }

            // Randomly assign 2-4 users to each team
            const numUsers = Math.floor(Math.random() * 3) + 2
            const shuffledUsers = users.sort(() => Math.random() - 0.5).slice(0, numUsers)

            for (const user of shuffledUsers) {
                const { error: memberError } = await supabaseServiceRole
                    .from('team_members')
                    .insert({
                        team_id: teamId,
                        user_id: user.id,
                        is_team_lead: Math.random() < 0.3 // 30% chance of being team lead
                    })

                if (memberError) {
                    console.error(`Error adding user to team ${team.name}:`, memberError)
                }
            }
        }
    } catch (error) {
        console.error('Error in createTeams:', error)
    }
}

// Update main execution
async function main() {
    try {
        const skillMap = await createSkills()
        await createTeams()
        await assignSkillsToUsers(skillMap)
        await createTeamSchedules()
        console.log('Test data generation completed successfully')
    } catch (error) {
        console.error('Error in main:', error)
    }
}

main()
    .catch(console.error)
    .finally(() => {
        process.exit(0)
    }) 