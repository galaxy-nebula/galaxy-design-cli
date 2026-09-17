#!/usr/bin/env node
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';
import { migrateTailwindCommand } from './commands/migrate-tailwind.js';
import { listCommand } from './commands/list.js';
import { doctorCommand } from './commands/doctor.js';
import { diffCommand } from './commands/diff.js';
import { updateCommand } from './commands/update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getCliVersion(): string {
  try {
    const packageJsonPath = resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      version?: string;
    };
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('nebula')
  .description('CLI tool for Galaxy UI component library')
  .version(getCliVersion());

program
  .command('init')
  .description('Initialize Galaxy UI in your project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .option('--theme <name>', 'Theme preset: default, violet, green, blue')
  .action(initCommand);

program
  .command('add')
  .description('Add components to your project')
  .argument('[components...]', 'Component names to add')
  .option('-a, --all', 'Add all components')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .option(
    '--overwrite',
    'Overwrite existing component files (with backup)',
    false,
  )
  .option(
    '--registry-url <url>',
    'Fetch component source from a versioned registry CDN (integrity-verified)',
  )
  .action(addCommand);

program
  .command('list')
  .description('List available Galaxy UI components')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .option('--framework <framework>', 'Framework to list components for')
  .option('--category <category>', 'Filter by category/group')
  .action(listCommand);

program
  .command('doctor')
  .description('Diagnose your Galaxy UI setup')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .action(doctorCommand);

program
  .command('diff')
  .description('Diff installed components against the registry source')
  .argument('[components...]', 'Component names to diff')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .action(diffCommand);

program
  .command('update')
  .description('Update installed components from the registry (with backup)')
  .argument('[components...]', 'Component names to update')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .action(updateCommand);

program
  .command('migrate')
  .description('Run Galaxy UI migration helpers')
  .command('tailwind')
  .description('Migrate a Tailwind v3 project to the Galaxy UI v4 scaffold')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .option('--dry-run', 'Preview the migration without writing files')
  .option('-y, --yes', 'Skip confirmation prompts')
  .action(migrateTailwindCommand);

program.parse();
