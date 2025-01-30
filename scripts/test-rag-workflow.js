import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = resolve(process.cwd(), '.env');
config({ path: envPath });

// Validate environment variables
const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'VITE_OPENAI_API_KEY'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

// Initialize clients with error handling
let client;
let vectorStore;
let llm;

try {
    // Initialize Supabase client
    client = createClient(
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
    vectorStore = new SupabaseVectorStore(
        new OpenAIEmbeddings({
            openAIApiKey: process.env.VITE_OPENAI_API_KEY
        }),
        {
            client,
            tableName: 'ai_documents',
            queryName: 'match_documents'
        }
    );

    // Initialize LLM
    llm = new ChatOpenAI({
        openAIApiKey: process.env.VITE_OPENAI_API_KEY,
        modelName: "gpt-3.5-turbo",
        temperature: 0.7
    });
} catch (error) {
    console.error('Error initializing services:', error);
    process.exit(1);
}

// Test cases for each document type
const testCases = [
    // KB Article tests
    {
        name: "KB Article - Technical Guide",
        query: "How do I set up two-factor authentication?",
        documentType: "kb_article",
        filter: {
            document_type: "kb_article",
            is_published: true
        },
        expectedContext: ["authentication", "security", "setup", "2FA"]
    },
    {
        name: "KB Article - Feature Documentation",
        query: "What customization options are available for the dashboard?",
        documentType: "kb_article",
        filter: {
            document_type: "kb_article",
            is_published: true
        },
        expectedContext: ["dashboard", "customize", "widgets", "settings"]
    },

    // Ticket tests with less restrictive filters
    {
        name: "Ticket - High Priority Issues",
        query: "What high priority issues need attention?",
        documentType: "ticket",
        filter: { 
            document_type: "ticket",
            priority: "high"
        },
        expectedContext: ["priority", "high", "issue", "urgent", "attention"]
    },
    {
        name: "Ticket - Feature Requests",
        query: "What feature requests do we have for the dashboard?",
        documentType: "ticket",
        filter: {
            document_type: "ticket"
            // Removed status filter to get all feature requests
        },
        expectedContext: ["dashboard", "feature", "request", "enhancement"]
    },
    {
        name: "Ticket - Open Issues",
        query: "What open issues need to be addressed?",
        documentType: "ticket",
        filter: {
            document_type: "ticket",
            status: "open"
            // Removed additional filters to see all open issues
        },
        expectedContext: ["open", "issue", "needs", "attention"]
    },

    // Team tests focusing on member information
    {
        name: "Team - Technical Support Members",
        query: "Who are the technical support team members and what are their skills?",
        documentType: "team",
        filter: {
            document_type: "team",
            name: "Technical Support Team"
        },
        expectedContext: ["technical", "support", "team", "members", "skills"]
    },
    {
        name: "Team - Product Team Members",
        query: "List the product team members and their areas of expertise",
        documentType: "team",
        filter: {
            document_type: "team",
            name: "Product Support Team"
        },
        expectedContext: ["product", "team", "members", "expertise", "skills"]
    },
    {
        name: "Team - Customer Success Members",
        query: "Show me the customer success team members and their responsibilities",
        documentType: "team",
        filter: {
            document_type: "team",
            name: "Customer Success Team"
        },
        expectedContext: ["customer", "success", "team", "members", "responsibilities"]
    },

    // Enhanced ticket queries with tags
    {
        name: "Ticket - Security Issues",
        query: "What security-related issues need attention?",
        documentType: "ticket",
        filter: { 
            document_type: "ticket",
            tags: ["security"]
        },
        expectedContext: ["security", "vulnerability", "urgent"]
    },
    {
        name: "Ticket - Performance Issues",
        query: "List all performance-related tickets",
        documentType: "ticket",
        filter: {
            document_type: "ticket",
            tags: ["performance", "optimization"]
        },
        expectedContext: ["performance", "slow", "optimization"]
    },
    {
        name: "Ticket - UI Enhancements",
        query: "What UI enhancement requests do we have?",
        documentType: "ticket",
        filter: {
            document_type: "ticket",
            tags: ["ui", "enhancement"]
        },
        expectedContext: ["ui", "enhancement", "feature"]
    },
    {
        name: "Ticket - Integration Issues",
        query: "Show me all integration-related tickets",
        documentType: "ticket",
        filter: {
            document_type: "ticket",
            tags: ["integration", "api"]
        },
        expectedContext: ["integration", "api", "technical"]
    }
];

// Update prompt template to better handle team member information
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful support system assistant. Using the following context, answer the question.
Consider the metadata of each document when formulating your response:
- For tickets: Consider priority and status to determine urgency and current state
- For teams: Focus on team members, their skills, and areas of expertise
- For KB articles: Consider relevance and applicability

Context: {context}

Question: {question}

Please provide a detailed answer that:
1. Directly addresses the question
2. References relevant metadata when applicable
3. Provides specific examples or evidence from the context
4. For team queries, include information about team members if available
5. Suggests related information if available

If you cannot answer the question based on the context, explain what information is missing.
`);

// Function to retrieve context
async function retrieveContext(question, filter) {
    try {
        const docs = await vectorStore.similaritySearch(
            question,
            4,
            filter
        );
        return docs.map(doc => doc.pageContent).join('\n\n');
    } catch (error) {
        console.error('Error retrieving context:', error);
        return '';
    }
}

// Function to generate response
async function generateResponse(question, context) {
    try {
        const formattedPrompt = await promptTemplate.format({
            context,
            question
        });
        const response = await llm.invoke(formattedPrompt);
        return response.content;
    } catch (error) {
        console.error('Error generating response:', error);
        return 'Error generating response';
    }
}

const testResults = [];

async function analyzeResults() {
    console.log('\n📊 Test Results Analysis');
    console.log('=======================');

    // Overall statistics
    const avgCoverage = testResults.reduce((sum, result) => sum + result.contextCoverage, 0) / testResults.length;
    console.log(`\nOverall Context Coverage: ${(avgCoverage * 100).toFixed(1)}%`);

    // Analysis by document type
    const documentTypeStats = new Map();
    testResults.forEach(result => {
        result.documentTypes.forEach(type => {
            const stats = documentTypeStats.get(type) || { count: 0, avgCoverage: 0 };
            stats.count++;
            stats.avgCoverage += result.contextCoverage;
            documentTypeStats.set(type, stats);
        });
    });

    console.log('\nPerformance by Document Type:');
    documentTypeStats.forEach((stats, type) => {
        const avgTypeCoverage = stats.avgCoverage / stats.count;
        console.log(`${type}: ${stats.count} queries, ${(avgTypeCoverage * 100).toFixed(1)}% avg coverage`);
    });

    // Keyword analysis
    const allKeywords = new Set(testResults.flatMap(r => r.matchedKeywords));
    console.log(`\nUnique Keywords Found: ${allKeywords.size}`);
    console.log('Top Keywords:', Array.from(allKeywords).slice(0, 10).join(', '));

    // Tests with low coverage
    const lowCoverageTests = testResults.filter(r => r.contextCoverage < 0.6);
    if (lowCoverageTests.length > 0) {
        console.log('\n⚠️ Tests Needing Improvement:');
        lowCoverageTests.forEach(test => {
            console.log(`- ${test.name} (${(test.contextCoverage * 100).toFixed(1)}% coverage)`);
        });
    }
}

async function runTest(testCase) {
    console.log(`\n🧪 Running test: ${testCase.name}`);
    console.log('Query:', testCase.query);
    console.log('Filter:', testCase.filter || 'None');

    try {
        // Test document retrieval
        console.log('\n📚 Testing document retrieval...');
        const docs = await vectorStore.similaritySearch(
            testCase.query,
            4,
            testCase.filter || (testCase.documentType ? { document_type: testCase.documentType } : undefined)
        );

        if (!docs || docs.length === 0) {
            console.log('No documents found');
            return;
        }

        console.log(`Found ${docs.length} relevant documents`);
        
        // Analyze retrieved documents
        docs.forEach((doc, index) => {
            console.log(`\nDocument ${index + 1}:`);
            console.log('Content:', doc.pageContent.substring(0, 150) + '...');
            console.log('Metadata:', doc.metadata);

            // Check for expected context keywords
            const matchedKeywords = testCase.expectedContext.filter(keyword => 
                doc.pageContent.toLowerCase().includes(keyword.toLowerCase())
            );
            console.log('Matched Context Keywords:', matchedKeywords);
        });

        // Calculate context coverage
        const allContent = docs.map(doc => doc.pageContent.toLowerCase()).join(' ');
        const contextCoverage = testCase.expectedContext.filter(keyword => 
            allContent.includes(keyword.toLowerCase())
        ).length / testCase.expectedContext.length;

        // Test response generation
        console.log('\n🤖 Testing response generation...');
        const context = await retrieveContext(
            testCase.query,
            testCase.filter || (testCase.documentType ? { document_type: testCase.documentType } : undefined)
        );
        const response = await generateResponse(testCase.query, context);

        console.log('\nGenerated Response:', response);
        console.log(`\n📊 Context Coverage: ${(contextCoverage * 100).toFixed(1)}%`);

        // Store test results
        testResults.push({
            name: testCase.name,
            query: testCase.query,
            contextCoverage,
            matchedKeywords: Array.from(new Set(docs.flatMap(doc => 
                testCase.expectedContext.filter(keyword => 
                    doc.pageContent.toLowerCase().includes(keyword.toLowerCase())
                )
            ))),
            documentCount: docs.length,
            documentTypes: new Set(docs.map(doc => doc.metadata.document_type)),
            response: response.toString()
        });

    } catch (error) {
        console.error(`Error in test "${testCase.name}":`, error);
    }
}

async function main() {
    try {
        console.log('Starting RAG workflow testing...');

        for (const testCase of testCases) {
            await runTest(testCase);
        }

        await analyzeResults();
        console.log('\nAll RAG workflow tests completed');
    } catch (error) {
        console.error('Error in main execution:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
}); 