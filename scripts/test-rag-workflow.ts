import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { config } from 'dotenv';
import { resolve } from 'path';
import { Document } from '@langchain/core/documents';
import { BaseMessage } from '@langchain/core/messages';

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

interface TestCase {
    name: string;
    query: string;
    documentType: string;
    expectedContext: string[];
    filter?: Record<string, any>;
}

// Initialize clients with error handling
let client = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

let vectorStore: SupabaseVectorStore = new SupabaseVectorStore(
    new OpenAIEmbeddings({
        openAIApiKey: process.env.VITE_OPENAI_API_KEY
    }),
    {
        client,
        tableName: 'ai_documents',
        queryName: 'match_documents'
    }
);

let llm: ChatOpenAI = new ChatOpenAI({
    openAIApiKey: process.env.VITE_OPENAI_API_KEY,
    modelName: "gpt-3.5-turbo",
    temperature: 0.7
});

// Test cases for each document type
const testCases = [
    // KB Article tests
    {
        name: "KB Article - Technical Guide",
        query: "How do I set up two-factor authentication?",
        documentType: "kb_article",
        expectedContext: ["authentication", "security", "setup", "2FA"]
    },
    {
        name: "KB Article - Feature Documentation",
        query: "What customization options are available for the dashboard?",
        documentType: "kb_article",
        expectedContext: ["dashboard", "customize", "widgets", "settings"]
    },

    // Enhanced Ticket tests
    {
        name: "Ticket - Technical Issue with Priority",
        query: "What are the high priority performance issues being reported?",
        documentType: "ticket",
        filter: { 
            document_type: "ticket",
            priority: "high"
        },
        expectedContext: ["performance", "slow", "degradation", "response time", "high priority"]
    },
    {
        name: "Ticket - Open Feature Requests",
        query: "What are the current open feature requests for the dashboard?",
        documentType: "ticket",
        filter: {
            document_type: "ticket",
            status: "open"
        },
        expectedContext: ["dashboard", "feature", "request", "enhancement", "open"]
    },
    {
        name: "Ticket - Recent Technical Issues",
        query: "What technical issues were reported in the last week?",
        documentType: "ticket",
        filter: {
            document_type: "ticket",
            created_after: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        expectedContext: ["technical", "issue", "error", "bug"]
    },

    // Enhanced Team tests
    {
        name: "Team - Technical Expertise",
        query: "Which team has the most experience with API integrations?",
        documentType: "team",
        filter: {
            document_type: "team",
            expertise: "technical"
        },
        expectedContext: ["technical", "API", "integration", "experience"]
    },
    {
        name: "Team - Support Coverage",
        query: "Which teams are available for immediate customer support?",
        documentType: "team",
        filter: {
            document_type: "team",
            availability: "current"
        },
        expectedContext: ["support", "available", "customer service", "immediate"]
    },
    {
        name: "Team - Specialized Skills",
        query: "Find teams with security and compliance expertise",
        documentType: "team",
        filter: {
            document_type: "team",
            skills: ["security", "compliance"]
        },
        expectedContext: ["security", "compliance", "governance", "expert"]
    }
];

// Create prompt template for response generation
const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful support system assistant. Using the following context, answer the question.
Consider the metadata of each document when formulating your response:
- For tickets: Consider priority, status, and creation date
- For teams: Consider expertise, availability, and specialized skills
- For KB articles: Consider relevance and applicability

Context: {context}

Question: {question}

Please provide a detailed answer that:
1. Directly addresses the question
2. References relevant metadata when applicable
3. Provides specific examples or evidence from the context
4. Suggests related information if available

If you cannot answer the question based on the context, explain what information is missing.
`);

// Function to retrieve context
async function retrieveContext(question: string, filter?: Record<string, any>): Promise<string> {
    try {
        const docs = await vectorStore.similaritySearch(
            question,
            4,
            filter
        );
        return docs.map((doc: Document) => doc.pageContent).join('\n\n');
    } catch (error) {
        console.error('Error retrieving context:', error);
        return '';
    }
}

// Function to generate response
async function generateResponse(question: string, context: string): Promise<string> {
    try {
        const formattedPrompt = await promptTemplate.format({
            context,
            question
        });
        const response = await llm.invoke(formattedPrompt);
        if (typeof response.content === 'string') {
            return response.content;
        }
        if (Array.isArray(response.content)) {
            return response.content
                .map(item => typeof item === 'string' ? item : '')
                .filter(Boolean)
                .join(' ');
        }
        return 'Unable to process response';
    } catch (error) {
        console.error('Error generating response:', error);
        return 'Error generating response';
    }
}

// Add test result analysis
interface TestResult {
    name: string;
    query: string;
    contextCoverage: number;
    matchedKeywords: string[];
    documentCount: number;
    documentTypes: Set<string>;
    response: string;
}

const testResults: TestResult[] = [];

async function analyzeResults() {
    console.log('\n📊 Test Results Analysis');
    console.log('=======================');

    // Overall statistics
    const avgCoverage = testResults.reduce((sum, result) => sum + result.contextCoverage, 0) / testResults.length;
    console.log(`\nOverall Context Coverage: ${(avgCoverage * 100).toFixed(1)}%`);

    // Analysis by document type
    const documentTypeStats = new Map<string, { count: number, avgCoverage: number }>();
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

// Update runTest function to store results
async function runTest(testCase: TestCase): Promise<void> {
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
        docs.forEach((doc: Document, index: number) => {
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
        const allContent = docs.map((doc: Document) => doc.pageContent.toLowerCase()).join(' ');
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
            matchedKeywords: Array.from(new Set(docs.flatMap((doc: Document) => 
                testCase.expectedContext.filter(keyword => 
                    doc.pageContent.toLowerCase().includes(keyword.toLowerCase())
                )
            ))),
            documentCount: docs.length,
            documentTypes: new Set(docs.map((doc: Document) => doc.metadata.document_type as string)),
            response: response.toString()
        });

    } catch (error) {
        console.error(`Error in test "${testCase.name}":`, error);
    }
}

// Main function
async function main(): Promise<void> {
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