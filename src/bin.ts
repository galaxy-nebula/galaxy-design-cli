#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { addCommand } from './commands/add.js';

const program = new Command();

program
  .name('galaxy-ui-cli')
  .description('CLI tool for Galaxy UI component library')
  .version('0.2.0');

program
  .command('init')
  .description('Initialize Galaxy UI in your project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .action(initCommand);

program
  .command('add')
  .description('Add components to your project')
  .argument('[components...]', 'Component names to add')
  .option('-a, --all', 'Add all components')
  .option('-c, --cwd <path>', 'Current working directory', process.cwd())
  .action(addCommand);

program.parse();
