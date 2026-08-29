#!/usr/bin/env node
// PreToolUse hook: technically enforces docs/frontend-only-scope.md.
// Blocks Edit/Write/NotebookEdit under server/, and Bash commands that
// look like they write to server/ or touch the database directly.
// Reading server/ (Read tool, cat/grep/ls in Bash) is intentionally
// unaffected -- the boundary is on writes, not on understanding the API.
'use strict';

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_ROOT = path.join(REPO_ROOT, 'server');
const SCOPE_DOC = 'docs/frontend-only-scope.md';

function respond(decision, reason) {
  if (decision === 'deny') {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }));
  }
  process.exit(0);
}

function isUnderServer(filePath) {
  if (!filePath) return false;
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(REPO_ROOT, filePath);
  const rel = path.relative(SERVER_ROOT, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

const BASH_SERVER_WRITE_PATTERNS = [
  />>?\s*server\//,
  /\bserver\/\.env\b/,
  /\b(rm|mv|cp|touch|chmod|tee)\b[^\n]*\bserver\//,
  /\bsed\b[^\n]*-i[^\n]*\bserver\//,
  /\bcd\s+server(\/|\s|$)/,
];

const BASH_DB_OR_SERVER_SCRIPT_PATTERNS = [
  /\bmongosh\b/,
  /\bmongo\b\s/,
  /\bmongoimport\b/,
  /\bmongorestore\b/,
  /\bmongodump\b/,
  /\bnode\s+server\/scripts\//,
  /\bnpm\s+(run\s+)?(seed|migrate|db:[a-z0-9:_-]+)\b/,
  /\b[a-zA-Z0-9_-]*(seed|migration)[a-zA-Z0-9_-]*\.(js|cjs|mjs|ts)\b/,
];

function bashLooksLikeServerMutation(command) {
  const hasPrefixServer = /--prefix(=|\s+)server\b/.test(command);
  const hasMutatingNpmVerb = /\bnpm\b[^\n]*\b(install|uninstall|update|ci|audit\s+fix)\b/.test(command);
  if (hasPrefixServer && hasMutatingNpmVerb) return true;

  const all = [...BASH_SERVER_WRITE_PATTERNS, ...BASH_DB_OR_SERVER_SCRIPT_PATTERNS];
  return all.some((re) => re.test(command));
}

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    return respond('allow');
  }

  const toolName = payload.tool_name;
  const toolInput = payload.tool_input || {};
  const suffix = `This repo is frontend-only right now (UI, animation, client-side routes) -- see ${SCOPE_DOC}. Backend/database changes are out of scope until Elijah explicitly approves them.`;

  if (toolName === 'Edit' || toolName === 'Write' || toolName === 'NotebookEdit') {
    const filePath = toolInput.file_path;
    if (isUnderServer(filePath)) {
      return respond('deny', `Blocked: "${filePath}" is inside server/ (the Express/MongoDB API). ${suffix}`);
    }
    return respond('allow');
  }

  if (toolName === 'Bash') {
    const command = toolInput.command || '';
    if (bashLooksLikeServerMutation(command)) {
      return respond('deny', `Blocked: this command looks like it writes to server/ or touches the database directly. ${suffix}`);
    }
    return respond('allow');
  }

  return respond('allow');
});
