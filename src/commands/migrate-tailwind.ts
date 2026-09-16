import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import {
  detectPackageManager,
  formatInstallCommand,
  installDependencies,
} from '../utils/package-manager.js';
import {
  applyTailwindMigration,
  planTailwindMigration,
} from '../utils/tailwind-migration.js';

interface MigrateTailwindOptions {
  cwd: string;
  dryRun?: boolean;
  yes?: boolean;
}

export async function migrateTailwindCommand(options: MigrateTailwindOptions) {
  const cwd = options.cwd;

  let plan;
  try {
    plan = planTailwindMigration(cwd);
  } catch (error) {
    console.log(
      chalk.red(
        `❌ ${error instanceof Error ? error.message : 'Failed to plan Tailwind migration.'}`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  console.log(chalk.bold.cyan('\n🌌 Galaxy UI Tailwind Migration\n'));
  console.log(chalk.green(`✓ Framework: ${chalk.bold(plan.framework)}`));
  console.log(
    chalk.green(
      `✓ Tailwind detection: ${chalk.bold(plan.detection.version === null ? 'unknown' : `v${plan.detection.version}`)} ${chalk.gray(`(${plan.detection.source})`)}`,
    ),
  );

  if (plan.detection.version !== 3) {
    console.log(
      chalk.yellow(`⚠ ${plan.notes[0] || 'No Tailwind v3 setup detected.'}`),
    );
    return;
  }

  console.log(chalk.cyan('\nMigration plan:'));
  for (const filePath of plan.filesToUpdate) {
    console.log(chalk.gray(`  - update ${filePath}`));
  }

  if (plan.addedDevDependencies.length > 0) {
    console.log(
      chalk.gray(
        `  - add devDependencies: ${plan.addedDevDependencies.join(', ')}`,
      ),
    );
  }
  if (plan.removedPackages.length > 0) {
    console.log(
      chalk.gray(
        `  - remove legacy packages from package.json: ${plan.removedPackages.join(', ')}`,
      ),
    );
  }

  if (plan.auditFindings.length > 0) {
    console.log(chalk.yellow('\nTailwind v4 review findings:'));
    for (const finding of plan.auditFindings) {
      console.log(
        chalk.yellow(
          `  - ${finding.filePath}: ${finding.pattern} (${finding.matches.join(', ')})`,
        ),
      );
    }
  }

  if (options.dryRun) {
    console.log(chalk.green('\n✓ Dry run complete. No files were changed.'));
    return;
  }

  if (!options.yes) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Apply the Tailwind v3 -> v4 migration now?',
      initial: false,
    });

    if (!confirm) {
      console.log(chalk.gray('Migration cancelled.'));
      return;
    }
  }

  const migrateSpinner = ora('Applying Tailwind migration...').start();

  let result;
  try {
    result = applyTailwindMigration(cwd);
    migrateSpinner.succeed(
      `Tailwind migration applied (${result.filesUpdated.length} files updated)`,
    );
  } catch (error) {
    migrateSpinner.fail('Failed to apply Tailwind migration');
    console.error(chalk.red(error));
    process.exitCode = 1;
    return;
  }

  console.log(chalk.gray(`Backup created at: ${result.backupDirectory}`));

  if (result.addedDevDependencies.length > 0) {
    const dependencySpinner = ora(
      'Installing Tailwind v4 dependencies...',
    ).start();

    try {
      await installDependencies(result.addedDevDependencies, {
        cwd,
        dev: true,
        silent: true,
      });
      dependencySpinner.succeed('Tailwind v4 dependencies installed');
    } catch {
      dependencySpinner.fail('Could not install dependencies automatically');
      const packageManager = detectPackageManager(cwd);
      console.log(
        chalk.yellow(
          `Run manually: ${formatInstallCommand(packageManager, result.addedDevDependencies, true)}`,
        ),
      );
      console.log(
        chalk.yellow(`Migration backup is available at ${result.backupDirectory}`),
      );
      process.exitCode = 1;
    }
  }

  if (result.removedPackages.length > 0) {
    console.log(
      chalk.gray(
        `Legacy packages removed from package.json: ${result.removedPackages.join(', ')}. Reinstall dependencies if your lockfile still references them.`,
      ),
    );
  }

  if (result.auditFindings.length > 0) {
    console.log(
      chalk.yellow('\nManual review recommended for these Tailwind utilities:'),
    );
    for (const finding of result.auditFindings) {
      console.log(chalk.yellow(`  - ${finding.filePath}: ${finding.message}`));
    }
  }
}
