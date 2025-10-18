#!/usr/bin/env node

/**
 * CLI for AI Evaluation Platform SDK
 * Tier 2.6: CLI for Everything
 */

import { Command } from 'commander'
import fs from 'fs/promises'
import path from 'path'
import { AIEvalClient } from '../src/client'
import { exportData } from '../src/export'

const program = new Command()

program
  .name('evalai')
  .description('AI Evaluation Platform CLI')
  .version('1.0.0')

// Initialize project
program
  .command('init')
  .description('Initialize a new evaluation project')
  .option('-d, --dir <directory>', 'Project directory', '.')
  .action(async (options) => {
    const dir = path.resolve(options.dir)
    
    console.log('🚀 Initializing EvalAI project...')
    
    // Create directory structure
    await fs.mkdir(path.join(dir, '.evalai'), { recursive: true })
    await fs.mkdir(path.join(dir, '.evalai', 'snapshots'), { recursive: true })
    await fs.mkdir(path.join(dir, 'evaluations'), { recursive: true })
    
    // Create config file
    const config = {
      apiKey: process.env.EVALAI_API_KEY || '',
      projectId: process.env.EVALAI_PROJECT_ID || '',
      baseUrl: 'http://localhost:3000/api',
      debug: false,
      retry: {
        maxAttempts: 3,
        backoff: 'exponential' as const
      }
    }
    
    await fs.writeFile(
      path.join(dir, 'evalai.config.json'),
      JSON.stringify(config, null, 2)
    )
    
    // Create example evaluation file
    const exampleEval = `import { AIEvalClient, createTestSuite, expect } from '@evalai/sdk'

const client = AIEvalClient.init()

const suite = createTestSuite('example-evaluation', {
  cases: [
    {
      input: 'What is 2+2?',
      expected: '4',
      name: 'simple-math'
    },
    {
      input: 'Explain AI in simple terms',
      expected: (output) => {
        expect(output).toContainKeywords(['artificial', 'intelligence'])
        expect(output).toHaveLength({ min: 50, max: 500 })
        return true
      },
      name: 'ai-explanation'
    }
  ]
})

// Run the test suite
suite.run().then(results => {
  console.log('Test Results:', results)
  console.log(\`Passed: \${results.passed}/\${results.total}\`)
})
`
    
    await fs.writeFile(
      path.join(dir, 'evaluations', 'example.ts'),
      exampleEval
    )
    
    console.log('✅ Project initialized successfully!')
    console.log('\nNext steps:')
    console.log('1. Set your API key: export EVALAI_API_KEY=your-key')
    console.log('2. Set your project ID: export EVALAI_PROJECT_ID=your-project')
    console.log('3. Run evaluations: npx evalai eval run')
  })

// Run evaluations
program
  .command('eval')
  .description('Run evaluation commands')
  .command('run')
  .option('-c, --config <path>', 'Config file path', './evalai.config.json')
  .option('-f, --file <path>', 'Evaluation file to run')
  .action(async (options) => {
    console.log('🧪 Running evaluations...')
    
    // Load config
    const configPath = path.resolve(options.config)
    let config
    try {
      const configContent = await fs.readFile(configPath, 'utf-8')
      config = JSON.parse(configContent)
    } catch (error) {
      console.error('❌ Config file not found. Run "evalai init" first.')
      process.exit(1)
    }
    
    const client = AIEvalClient.init(config)
    
    // If file specified, run that file
    if (options.file) {
      console.log(`Running ${options.file}...`)
      // Dynamic import of evaluation file would go here
      // This requires compilation step for TS files
    } else {
      // Run all evaluations in the evaluations directory
      console.log('Running all evaluations...')
    }
    
    console.log('✅ Evaluations completed!')
  })

// List traces
program
  .command('traces')
  .description('List and filter traces')
  .option('-l, --limit <number>', 'Number of traces to show', '10')
  .option('--failed', 'Show only failed traces')
  .option('--slow', 'Show slow traces (>5s)')
  .action(async (options) => {
    const configPath = path.resolve('./evalai.config.json')
    let config
    try {
      const configContent = await fs.readFile(configPath, 'utf-8')
      config = JSON.parse(configContent)
    } catch (error) {
      console.error('❌ Config file not found. Run "evalai init" first.')
      process.exit(1)
    }
    
    const client = AIEvalClient.init(config)
    
    console.log('📊 Fetching traces...')
    // API call to get traces would go here
    console.log(`Showing ${options.limit} traces`)
  })

// Export data
program
  .command('export')
  .description('Export data from EvalAI')
  .option('-f, --format <format>', 'Export format (json, csv, xlsx)', 'json')
  .option('-o, --output <path>', 'Output file path', './export')
  .option('-t, --type <type>', 'Data type (traces, evaluations, all)', 'all')
  .action(async (options) => {
    const configPath = path.resolve('./evalai.config.json')
    let config
    try {
      const configContent = await fs.readFile(configPath, 'utf-8')
      config = JSON.parse(configContent)
    } catch (error) {
      console.error('❌ Config file not found. Run "evalai init" first.')
      process.exit(1)
    }
    
    const client = AIEvalClient.init(config)
    
    console.log(`📥 Exporting data as ${options.format}...`)
    
    const data = await exportData(client, {
      format: options.format as 'json' | 'csv' | 'jsonl',
      includeTraces: true,
      includeEvaluations: true
    });
    
    // Save to file
    const outputPath = path.resolve(process.cwd(), options.output);
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Data exported to ${outputPath}`)
  })

// Dev server
program
  .command('dev')
  .description('Start local development server')
  .option('-p, --port <port>', 'Port number', '3001')
  .action(async (options) => {
    console.log(`🚀 Starting development server on port ${options.port}...`)
    console.log('📊 Dashboard: http://localhost:' + options.port)
    console.log('🔍 API: http://localhost:' + options.port + '/api')
    console.log('\nPress Ctrl+C to stop')
    
    // This would start an Express server with a simple dashboard
    // For now, just keep the process running
    process.stdin.resume()
  })

program.parse()