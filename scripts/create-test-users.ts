import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

// Test Users Data
const testUsers = [
    // Technical Support Team - All agents due to direct support responsibilities
    {
        email: 'infrastructure.lead@example.com',
        password: 'testpass123',
        full_name: 'Infrastructure Lead',
        role: 'agent'
    },
    {
        email: 'db.specialist@example.com',
        password: 'testpass123',
        full_name: 'Database Specialist',
        role: 'agent'
    },
    {
        email: 'network.engineer@example.com',
        password: 'testpass123',
        full_name: 'Network Engineer',
        role: 'agent'
    },
    {
        email: 'senior.backend@example.com',
        password: 'testpass123',
        full_name: 'Senior Backend Engineer',
        role: 'agent'
    },
    {
        email: 'app.support@example.com',
        password: 'testpass123',
        full_name: 'App Support Specialist',
        role: 'agent'
    },
    {
        email: 'technical.writer@example.com',
        password: 'testpass123',
        full_name: 'Technical Writer',
        role: 'user'  // Changed: Documentation role
    },
    {
        email: 'security.lead@example.com',
        password: 'testpass123',
        full_name: 'Security Lead',
        role: 'agent'
    },
    {
        email: 'security.analyst@example.com',
        password: 'testpass123',
        full_name: 'Security Analyst',
        role: 'agent'
    },
    {
        email: 'compliance.specialist@example.com',
        password: 'testpass123',
        full_name: 'Compliance Specialist',
        role: 'user'  // Changed: Internal role
    },

    // Product Team - Mix based on customer interaction
    {
        email: 'product.manager@example.com',
        password: 'testpass123',
        full_name: 'Product Manager',
        role: 'agent'  // Handles customer feedback and issues
    },
    {
        email: 'frontend.lead@example.com',
        password: 'testpass123',
        full_name: 'Frontend Lead',
        role: 'agent'  // Handles technical issues
    },
    {
        email: 'api.support@example.com',
        password: 'testpass123',
        full_name: 'API Support Engineer',
        role: 'agent'  // Direct API support
    },
    {
        email: 'innovation.lead@example.com',
        password: 'testpass123',
        full_name: 'Innovation Lead',
        role: 'user'  // Changed: Internal role
    },
    {
        email: 'product.researcher@example.com',
        password: 'testpass123',
        full_name: 'Product Researcher',
        role: 'user'  // Changed: Internal role
    },
    {
        email: 'ux.specialist@example.com',
        password: 'testpass123',
        full_name: 'UX Specialist',
        role: 'user'  // Changed: Internal role
    },

    // Specialized Teams - Based on customer interaction
    {
        email: 'enterprise.lead@example.com',
        password: 'testpass123',
        full_name: 'Enterprise Lead',
        role: 'agent'  // Direct customer support
    },
    {
        email: 'senior.support@example.com',
        password: 'testpass123',
        full_name: 'Senior Support Engineer',
        role: 'agent'  // Direct customer support
    },
    {
        email: 'solution.architect@example.com',
        password: 'testpass123',
        full_name: 'Solution Architect',
        role: 'agent'  // Customer solutions
    },
    {
        email: 'customer.success@example.com',
        password: 'testpass123',
        full_name: 'Customer Success Manager',
        role: 'agent'  // Direct customer interaction
    },
    {
        email: 'training.specialist@example.com',
        password: 'testpass123',
        full_name: 'Training Specialist',
        role: 'user'  // Changed: Internal role
    },
    {
        email: 'account.manager@example.com',
        password: 'testpass123',
        full_name: 'Account Manager',
        role: 'agent'  // Direct customer interaction
    },

    // Support Staff - Based on customer interaction
    {
        email: 'billing.support@example.com',
        password: 'testpass123',
        full_name: 'Billing Support',
        role: 'agent'  // Direct customer support
    },
    {
        email: 'support.specialist@example.com',
        password: 'testpass123',
        full_name: 'Support Specialist',
        role: 'agent'  // Direct customer support
    },
    {
        email: 'legal.team@example.com',
        password: 'testpass123',
        full_name: 'Legal Team Member',
        role: 'user'  // Changed: Internal role
    }
];

// Map to store created user IDs
export const userIdMap = new Map<string, string>();

async function createTestUsers() {
    console.log('Creating or updating test users...');

    for (const user of testUsers) {
        // First try to get the user
        const { data: existingUser, error: getUserError } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', user.email)
            .single();

        if (getUserError && getUserError.code !== 'PGRST116') {
            console.error(`Error checking user ${user.email}:`, getUserError);
            continue;
        }

        if (existingUser) {
            // User exists, update their role
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ role: user.role })
                .eq('id', existingUser.id);

            if (updateError) {
                console.error(`Error updating role for ${user.email}:`, updateError);
                continue;
            }

            console.log(`Updated role for user: ${user.email} (${existingUser.id})`);
            const userKey = user.email.split('@')[0].replace(/\./g, '_');
            userIdMap.set(userKey, existingUser.id);
        } else {
            // Create new user
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true,
                user_metadata: {
                    full_name: user.full_name
                }
            });

            if (authError) {
                console.error(`Error creating user ${user.email}:`, authError);
                continue;
            }

            // Store the user ID in our map
            const userKey = user.email.split('@')[0].replace(/\./g, '_');
            userIdMap.set(userKey, authData.user.id);

            // Update profile with role
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ role: user.role })
                .eq('id', authData.user.id);

            if (profileError) {
                console.error(`Error updating profile for ${user.email}:`, profileError);
                continue;
            }

            console.log(`Created user: ${user.email} (${authData.user.id})`);
        }
    }

    // Output the user ID map for reference
    console.log('\nUser ID Map:');
    for (const [key, value] of userIdMap.entries()) {
        console.log(`${key}: ${value}`);
    }
}

// Run the script
createTestUsers().catch(console.error); 