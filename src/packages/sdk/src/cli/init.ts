#!/usr/bin/env node

/**
 * evalai init — Create evalai.config.json
 *
 * Creates the smallest possible config file. Defaults belong in code.
 */

import * as fs from 'fs';
import * as path from 'path';

const CONFIG_CONTENT = `{
  "evaluationId": ""
}
`;

export function runInit(cwd: string = process.cwd()): boolean {
  const configPath = path.join(cwd, 'evalai.config.json');

  if (fs.existsSync(configPath)) {
    console.log(`evalai.config.json already exists at ${configPath}`);
    return false;
  }

  fs.writeFileSync(configPath, CONFIG_CONTENT, 'utf-8');
  console.log(`Created ${configPath}`);
  console.log('');
  console.log('Next step: Create an evaluation in the dashboard, paste its ID into evalai.config.json, then run: npx evalai check');
  console.log('To uninstall: delete evalai.config.json.');
  return true;
}
