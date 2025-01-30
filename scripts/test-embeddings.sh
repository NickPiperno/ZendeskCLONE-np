#!/bin/bash

# Check if environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ] || [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: Required environment variables are not set."
    echo "Please ensure the following variables are set:"
    echo "- VITE_SUPABASE_URL"
    echo "- VITE_SUPABASE_ANON_KEY"
    echo "- OPENAI_API_KEY"
    exit 1
fi

# Run the test script using ts-node
echo "Running embedding generation test..."
npx ts-node src/lib/langchain/embeddings/generate.ts --test 