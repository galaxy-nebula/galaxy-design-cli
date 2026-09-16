import chalk from 'chalk';
import {
  loadComponentsConfig,
  hasComponentsConfig,
} from '../utils/components-config.js';
import {
  getAllFrameworkComponents,
  getAllFrameworkGroups,
  type RegistryTarget,
} from '../utils/framework-registry-service.js';

interface ListOptions {
  cwd: string;
  framework?: string;
  category?: string;
}

export async function listCommand(options: ListOptions) {
  const cwd = options.cwd;

  const config = hasComponentsConfig(cwd) ? loadComponentsConfig(cwd) : null;
  const frameworkInput = options.framework ?? config?.framework;

  if (!frameworkInput) {
    console.log(
      chalk.red(
        '❌ No components.json found. Run `galaxy-design init` first, or pass --framework <framework>.',
      ),
    );
    process.exitCode = 1;
    return;
  }

  const framework = frameworkInput as RegistryTarget;

  const allComponents = getAllFrameworkComponents(framework);
  const groups = getAllFrameworkGroups(framework);

  const requestedCategory = options.category;

  if (requestedCategory && !groups[requestedCategory]) {
    console.log(
      chalk.red(`❌ Unknown category "${requestedCategory}" for ${framework}.`),
    );
    console.log(chalk.gray(`Available: ${Object.keys(groups).join(', ')}`));
    process.exitCode = 1;
    return;
  }

  const grouped = new Map<
    string,
    Array<[string, (typeof allComponents)[string]]>
  >();
  for (const [key, component] of Object.entries(allComponents)) {
    const category = component.category || 'other';
    if (requestedCategory && category !== requestedCategory) {
      continue;
    }
    const bucket = grouped.get(category) ?? [];
    bucket.push([key, component]);
    grouped.set(category, bucket);
  }

  const total = Object.keys(allComponents).length;

  console.log(
    chalk.bold.cyan(`\n🌌 Galaxy UI components — ${chalk.bold(framework)}\n`),
  );

  const sortedCategories = [...grouped.keys()].sort();
  for (const category of sortedCategories) {
    const entries = grouped.get(category) ?? [];
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    const groupLabel =
      groups[category]?.name ||
      category.charAt(0).toUpperCase() + category.slice(1);
    console.log(chalk.bold.yellow(`${groupLabel} (${entries.length})`));

    for (const [key, component] of entries) {
      console.log(
        `  ${chalk.green(key.padEnd(22))} ${chalk.white(component.name)} — ${chalk.gray(component.description)}`,
      );
    }
    console.log('');
  }

  console.log(
    chalk.gray(
      `${total} component(s) available for ${framework}. Run \`galaxy-design add <name>\` to install.`,
    ),
  );
}
