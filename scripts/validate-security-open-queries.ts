import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

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

// Add type definitions at the top
interface ValidationResult {
  testName: string;
  coverage: number;
  metadataValid: boolean;
  results: Array<{
    content: string;
    matchedKeywords: string[];
    score: number;
    relevance: string;
  }>;
}

interface TestCase {
  name: string;
  query: string;
  filter: Record<string, any>;
  expectedKeywords: string[];
  minScore: number;
}

// Enhanced fuzzy matching with partial word matches
function enhancedFuzzyMatch(text: string, keyword: string): boolean {
  const normalizedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const normalizedKeyword = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  
  // Check for exact match
  if (normalizedText.includes(normalizedKeyword)) {
    return true;
  }

  // Check for word-by-word partial matches
  const textWords = normalizedText.split(/\s+/);
  const keywordWords = normalizedKeyword.split(/\s+/);
  
  return keywordWords.every(kw => 
    textWords.some(tw => 
      tw.includes(kw) || kw.includes(tw)
    )
  );
}

// Update test cases with improved matching
const testCases: TestCase[] = [
  {
    name: 'Security Vulnerability Search',
    query: 'Find critical security vulnerabilities and incidents',
    filter: {
      document_type: 'ticket',
      tags: { $in: ['security', 'vulnerability', 'incident'] },
      priority: { $in: ['high', 'urgent'] },
      status: { $in: ['open', 'in_progress'] }
    },
    expectedKeywords: ['security', 'vulnerability', 'breach', 'incident', 'critical', 'risk'],
    minScore: 0.3
  },
  {
    name: 'Security Policy Documentation',
    query: 'Find security policies, compliance, and best practices documentation',
    filter: {
      document_type: 'kb_article',
      tags: { $in: ['security', 'policy', 'compliance'] },
      is_published: true,
      status: 'active'
    },
    expectedKeywords: ['security', 'policy', 'compliance', 'best practice', 'guideline', 'procedure'],
    minScore: 0.3
  },
  {
    name: 'Security Team Expertise',
    query: 'Find security team members and their expertise',
    filter: {
      document_type: 'team',
      skills: { $elemMatch: { $in: ['security', 'incident_response'] } }
    },
    expectedKeywords: ['security', 'expert', 'specialist', 'analyst', 'engineer'],
    minScore: 0.3
  },
  {
    name: 'High Priority Open Issues',
    query: 'Find urgent and high priority open tickets',
    filter: {
      document_type: 'ticket',
      status: 'open',
      priority: { $in: ['high', 'urgent'] },
      deleted: false,
      resolution: null
    },
    expectedKeywords: ['urgent', 'high priority', 'critical', 'important'],
    minScore: 0.3
  },
  {
    name: 'Long-standing Issues',
    query: 'Find tickets that have been open for more than 30 days',
    filter: {
      document_type: 'ticket',
      status: 'open',
      created_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      deleted: false,
      resolution: null
    },
    expectedKeywords: ['overdue', 'delayed', 'pending', 'long-standing', 'old'],
    minScore: 0.3
  },
  {
    name: 'Unassigned Critical Issues',
    query: 'Find unassigned high priority tickets',
    filter: {
      document_type: 'ticket',
      status: 'open',
      assigned_to: null,
      priority: { $in: ['high', 'urgent'] },
      deleted: false
    },
    expectedKeywords: ['unassigned', 'needs assignment', 'high priority', 'urgent'],
    minScore: 0.3
  }
];

// Update validateQuery function with improved matching and scoring
async function validateQuery(testCase: TestCase): Promise<ValidationResult> {
  const results = await vectorStore.similaritySearch(testCase.query, 10, testCase.filter);
  
  const keywordMatches = results.map(result => {
    const content = result.pageContent;
    const metadata = result.metadata;
    
    // Check content, title, and tags for keyword matches
    const matchedKeywords = testCase.expectedKeywords.filter(keyword => {
      const contentMatch = enhancedFuzzyMatch(content, keyword);
      const titleMatch = metadata.title && enhancedFuzzyMatch(metadata.title, keyword);
      const tagMatch = metadata.tags && metadata.tags.some((tag: string) => enhancedFuzzyMatch(tag, keyword));
      const descriptionMatch = metadata.description && enhancedFuzzyMatch(metadata.description, keyword);
      
      return contentMatch || titleMatch || tagMatch || descriptionMatch;
    });

    // Calculate combined relevance score
    const keywordScore = matchedKeywords.length / testCase.expectedKeywords.length;
    const metadataScore = validateMetadataWithOperators(metadata, testCase.filter) ? 1 : 0;
    const baseScore = (result as any).metadata?.score ?? 0;
    
    const combinedScore = (
      keywordScore * 0.4 +  // Keyword matching weight
      metadataScore * 0.4 + // Metadata matching weight
      baseScore * 0.2       // Base similarity score weight
    );

    return {
      content: content,
      matchedKeywords,
      score: combinedScore,
      relevance: combinedScore >= testCase.minScore ? 'High' : 'Low'
    };
  });

  // Calculate weighted coverage
  const coverage = keywordMatches.reduce((acc, match) => {
    const isRelevant = match.score >= testCase.minScore;
    const weight = isRelevant ? 1 : match.score / testCase.minScore;
    return acc + weight;
  }, 0) / Math.max(results.length, 1);

  // Validate metadata with more flexible matching
  const metadataValid = results.some(result => 
    validateMetadataWithOperators(result.metadata, testCase.filter)
  );

  return {
    testName: testCase.name,
    coverage: Math.min(coverage, 1),
    metadataValid,
    results: keywordMatches
  };
}

// Helper function to validate metadata with operators
function validateMetadataWithOperators(metadata: any, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (value === null) {
      return metadata[key] === null;
    }
    if (typeof value === 'object') {
      if ('$in' in value) {
        return Array.isArray(metadata[key]) 
          ? metadata[key].some((v: any) => value.$in.includes(v))
          : value.$in.includes(metadata[key]);
      }
      if ('$elemMatch' in value) {
        return Array.isArray(metadata[key]) && metadata[key].some((elem: any) => 
          validateMetadataWithOperators(elem, value.$elemMatch)
        );
      }
      if ('$lt' in value) {
        return new Date(metadata[key]) < new Date(value.$lt);
      }
      if ('$exists' in value) {
        return value.$exists ? metadata[key] !== undefined : metadata[key] === undefined;
      }
    }
    return metadata[key] === value;
  });
}

// Update main function with detailed reporting
async function main() {
  console.log('🔍 Starting Enhanced Query Validation\n');

  // Run all tests
  const allResults = await Promise.all(testCases.map(validateQuery));
  
  // Split results by category
  const securityResults = allResults.slice(0, 3); // First 3 are security tests
  const openIssuesResults = allResults.slice(3);  // Rest are open issues tests

  // Calculate coverage
  const securityCoverage = securityResults.reduce((acc, result) => acc + result.coverage, 0) / securityResults.length;
  const openIssuesCoverage = openIssuesResults.reduce((acc, result) => acc + result.coverage, 0) / openIssuesResults.length;

  // Print detailed results
  console.log('📊 Security Queries Results:');
  securityResults.forEach(result => {
    console.log(`\n${result.testName}:`);
    console.log(`Coverage: ${Math.round(result.coverage * 100)}%`);
    console.log(`Metadata Valid: ${result.metadataValid ? '✅' : '❌'}`);
    console.log('Top matches:', result.results.slice(0, 3).map(r => ({
      keywords: r.matchedKeywords,
      relevance: r.relevance
    })));
  });

  console.log('\n📊 Open Issues Queries Results:');
  openIssuesResults.forEach(result => {
    console.log(`\n${result.testName}:`);
    console.log(`Coverage: ${Math.round(result.coverage * 100)}%`);
    console.log(`Metadata Valid: ${result.metadataValid ? '✅' : '❌'}`);
    console.log('Top matches:', result.results.slice(0, 3).map(r => ({
      keywords: r.matchedKeywords,
      relevance: r.relevance
    })));
  });

  console.log('\n📈 Overall Coverage Summary');
  console.log(`Security Queries Coverage: ${Math.round(securityCoverage * 100)}%`);
  console.log(`Open Issues Queries Coverage: ${Math.round(openIssuesCoverage * 100)}%`);
}

main().catch(console.error); 