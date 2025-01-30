import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { config } from 'dotenv';
import { resolve } from 'path';
import { Document } from '@langchain/core/documents';

// Load environment variables
const envPath = resolve(process.cwd(), '.env');
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

// Initialize vector store
const vectorStore = new SupabaseVectorStore(
    new OpenAIEmbeddings(),
    {
        client,
        tableName: 'ai_documents',
        queryName: 'match_documents'
    }
);

interface TestCase {
    name: string;
    query: string;
    expectedType?: 'kb_article' | 'ticket' | 'team';
    expectedKeywords?: string[];
}

const testCases: TestCase[] = [
    // Exact match queries
    {
        name: "Exact KB Article Match",
        query: "Dark Mode Feature Request",
        expectedType: "kb_article",
        expectedKeywords: ["dark mode", "feature"]
    },
    {
        name: "Exact Ticket Match",
        query: "Cannot access dashboard",
        expectedType: "ticket",
        expectedKeywords: ["dashboard", "access"]
    },

    // Semantic similarity queries
    {
        name: "Semantic KB Search",
        query: "How to customize the user interface appearance",
        expectedType: "kb_article",
        expectedKeywords: ["dark mode", "ui", "feature"]
    },
    {
        name: "Semantic Ticket Search",
        query: "System performance issues",
        expectedType: "ticket",
        expectedKeywords: ["performance", "slow", "degradation"]
    },

    // Cross-document type queries
    {
        name: "Cross-Document Technical Issue",
        query: "API authentication problems",
        expectedKeywords: ["api", "authentication", "access"]
    },

    // Team-specific queries
    {
        name: "Team Expertise Search",
        query: "Which team handles security incidents",
        expectedType: "team",
        expectedKeywords: ["security", "technical"]
    },

    // Security-related queries
    {
        name: "Security Vulnerability Search",
        query: "Find all security vulnerabilities in the authentication system",
        expectedType: "ticket",
        expectedKeywords: ["security", "vulnerability", "authentication", "risk"]
    },
    {
        name: "Security Policy Documentation",
        query: "What are our security best practices and policies",
        expectedType: "kb_article",
        expectedKeywords: ["security", "policy", "best practices", "guidelines"]
    },
    {
        name: "Security Incident Reports",
        query: "Recent security incidents or breaches",
        expectedType: "ticket",
        expectedKeywords: ["security", "incident", "breach", "report"]
    },
    {
        name: "Security Team Expertise",
        query: "Security team capabilities and expertise",
        expectedType: "team",
        expectedKeywords: ["security", "expertise", "incident response"]
    },

    // Open issues queries
    {
        name: "Current Open Issues",
        query: "Show all currently open tickets",
        expectedType: "ticket",
        expectedKeywords: ["open", "pending", "active"]
    },
    {
        name: "High Priority Open Issues",
        query: "List all high priority open tickets",
        expectedType: "ticket",
        expectedKeywords: ["high priority", "urgent", "open"]
    },
    {
        name: "Open Feature Requests",
        query: "Show open feature enhancement requests",
        expectedType: "ticket",
        expectedKeywords: ["feature", "enhancement", "open"]
    },
    {
        name: "Long-standing Open Issues",
        query: "Find tickets that have been open for a long time",
        expectedType: "ticket",
        expectedKeywords: ["open", "pending", "delayed"]
    }
];

async function runTest(testCase: TestCase) {
    console.log(`\nRunning test: ${testCase.name}`);
    console.log('Query:', testCase.query);

    try {
        // Perform similarity search
        const results = await vectorStore.similaritySearch(
            testCase.query,
            4,
            testCase.expectedType ? { document_type: testCase.expectedType } : undefined
        );

        console.log(`Found ${results.length} results`);

        // Analyze results
        results.forEach((doc: Document, index: number) => {
            console.log(`\nResult ${index + 1}:`);
            console.log('Content:', doc.pageContent.substring(0, 150) + '...');
            console.log('Metadata:', doc.metadata);

            // Check for expected keywords if specified
            if (testCase.expectedKeywords) {
                const matchedKeywords = testCase.expectedKeywords.filter(keyword => 
                    doc.pageContent.toLowerCase().includes(keyword.toLowerCase())
                );
                console.log('Matched Keywords:', matchedKeywords);
            }

            // Validate document type if specified
            if (testCase.expectedType) {
                const typeMatch = doc.metadata.document_type === testCase.expectedType;
                console.log('Type Match:', typeMatch ? '✓' : '✗');
            }
        });

    } catch (error) {
        console.error(`Error in test "${testCase.name}":`, error);
    }
}

async function main() {
    console.log('Starting vector store query validation tests...');

    for (const testCase of testCases) {
        await runTest(testCase);
    }

    console.log('\nAll tests completed');
}

main().catch(console.error); 