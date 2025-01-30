import { testEmbeddings, generateAllEmbeddings } from '../src/lib/langchain/embeddings/generate';

async function main() {
    const isTestRun = process.argv.includes('--test');
    
    try {
        if (isTestRun) {
            console.log('Running test embedding generation...');
            await testEmbeddings();
        } else {
            console.log('Running full embedding generation...');
            await generateAllEmbeddings();
        }
    } catch (error) {
        console.error('Error during embedding generation:', error);
        process.exit(1);
    }
}

main(); 