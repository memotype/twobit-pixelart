const fs = require('node:fs');
const path = require('node:path');

const userAgent = process.env.npm_config_user_agent || '';
const execPath = process.env.npm_execpath || '';
const isRuntime = process.argv.includes('--runtime');
const combined = `${userAgent} ${execPath}`.toLowerCase();
const banned = ['yarn', 'pnpm', 'bun'];

const isBanned = banned.some((name) => combined.includes(name));
const isNpm = userAgent.startsWith('npm/') || combined.includes('npm-cli.js');

const repoRoot = path.resolve(__dirname, '..');
const packagePath = path.join(repoRoot, 'package.json');
let requiredNpmVersion = '';

try {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const packageManager = typeof pkg.packageManager === 'string'
    ? pkg.packageManager
    : '';
  if (packageManager.startsWith('npm@')) {
    requiredNpmVersion = packageManager.slice('npm@'.length);
  }
} catch {
  requiredNpmVersion = '';
}

const match = userAgent.match(/^npm\/([0-9]+(\.[0-9]+){2})/);
const npmVersion = match ? match[1] : '';

if (isBanned || !isNpm) {
  console.error('ERROR: This repo supports npm only.');
  if (isRuntime) {
    console.error('Run scripts with npm, not yarn, pnpm, or bun.');
  } else {
    console.error('Use npm install, not yarn, pnpm, or bun.');
  }
  process.exit(1);
}

if (requiredNpmVersion && npmVersion && npmVersion !== requiredNpmVersion) {
  console.error(
    `ERROR: npm ${requiredNpmVersion} is required, ` +
      `but ${npmVersion} is active.`,
  );
  console.error('Use the npm version declared in package.json.');
  process.exit(1);
}
