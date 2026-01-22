const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const ignoreDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

function hasTypeScriptFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (hasTypeScriptFiles(fullPath)) {
        return true;
      }
      continue;
    }

    if (entry.isFile()) {
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        return true;
      }
    }
  }

  return false;
}

if (!hasTypeScriptFiles(repoRoot)) {
  console.log('No TypeScript files found. Skipping typecheck.');
  process.exit(0);
}

const tscPath = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

const result = spawnSync('node', [tscPath, '--noEmit'], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
