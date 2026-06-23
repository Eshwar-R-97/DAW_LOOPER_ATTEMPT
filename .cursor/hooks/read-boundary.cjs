#!/usr/bin/env node
/**
 * Blocks agent file reads outside the workspace and configured reference paths.
 * Writes inside the workspace are unaffected (handled by sandbox + edit tools).
 */
const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const SENSITIVE = /\.(env|key|pem)$|\.env\.|credentials|secret/i;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      if (data.length < MAX_STDIN) {
        data += chunk.substring(0, MAX_STDIN - data.length);
      }
    });
    process.stdin.on('end', () => resolve(data));
  });
}

function expandHome(value) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (value.startsWith('$HOME/') || value.startsWith('$HOME\\')) {
    return path.join(home, value.slice('$HOME'.length + 1));
  }
  if (value.startsWith('~/')) {
    return path.join(home, value.slice(2));
  }
  return value;
}

function resolvePath(filePath) {
  const expanded = expandHome(filePath);
  try {
    if (typeof fs.realpathSync.native === 'function') {
      return fs.realpathSync.native(expanded);
    }
    return fs.realpathSync(expanded);
  } catch {
    return path.resolve(expanded);
  }
}

function isUnder(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function loadConfig(workspaceRoot) {
  const configPath = path.join(workspaceRoot, '.cursor', 'read-boundary.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { additionalReadonlyPaths: [] };
  }
}

function collectAllowedRoots(input) {
  const workspaceRoots = (input.workspace_roots || input.workspaceRoots || [])
    .map((root) => resolvePath(root));

  const primaryRoot = workspaceRoots[0] || resolvePath(process.cwd());
  const config = loadConfig(primaryRoot);
  const extraRoots = (config.additionalReadonlyPaths || []).map((root) => resolvePath(root));

  return [...new Set([...workspaceRoots, ...extraRoots])];
}

readStdin()
  .then((raw) => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      process.stdout.write(raw || '');
      return;
    }

    const filePath =
      input.path ||
      input.file ||
      input.args?.filePath ||
      input.tool_input?.file_path ||
      '';

    if (!filePath) {
      process.stdout.write(raw);
      return;
    }

    const resolved = resolvePath(filePath);

    if (SENSITIVE.test(resolved)) {
      process.stderr.write(
        `[read-boundary] BLOCKED sensitive file read: ${filePath}\n`
      );
      process.exit(2);
    }

    const allowedRoots = collectAllowedRoots(input);
    const allowed = allowedRoots.some((root) => isUnder(resolved, root));

    if (!allowed) {
      process.stderr.write(
        `[read-boundary] BLOCKED read outside allowed paths: ${filePath}\n`
      );
      process.stderr.write(
        '[read-boundary] Allowed: DAWLOOPER workspace + paths in .cursor/read-boundary.json\n'
      );
      process.exit(2);
    }

    process.stdout.write(raw);
  })
  .catch(() => process.exit(0));
