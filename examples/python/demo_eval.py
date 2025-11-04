"""
Demo Evaluation Run (Python)

This example demonstrates how to run an evaluation using the AI Evaluation Platform SDK in Python.
It creates an evaluation against a demo dataset and saves the results to a JSON file.

Usage:
    python demo_eval.py
"""

import os
import json
from evalai_sdk import AIEvalClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_demo():
    try:
        # Initialize the client
        client = AIEvalClient(
            api_key=os.getenv('EVALAI_API_KEY')
        )

        print('🚀 Starting evaluation...\n')

        # Create an evaluation
        result = client.evaluations.create(
            dataset_id='public-demo-chatbot',
            metrics=['factuality', 'toxicity'],
            name='Demo Chatbot Evaluation',
            description='Testing chatbot responses for accuracy and safety'
        )

        print('✅ Evaluation complete!\n')
        print(f'📊 Overall Score: {result.overall}')
        print(f'✓ Passed: {result.passed}')
        print(f'✗ Failed: {result.failed}')
        print(f'⏱️  Avg Latency: {result.avg_latency}ms')
        print(f'💰 Total Cost: ${result.total_cost}\n')

        # Save results to file
        with open('demo-run.json', 'w') as f:
            json.dump(result.to_dict(), f, indent=2)
        
        print('💾 Results saved to demo-run.json')

        return result

    except Exception as e:
        print(f'❌ Error running evaluation: {str(e)}')
        exit(1)

if __name__ == '__main__':
    run_demo()
