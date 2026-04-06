/**
 * Post-edit verification hook.
 *
 * Fires on PostToolUse for file-editing tools and injects a system message
 * requiring the agent to verify the change before continuing.
 */

const EDIT_TOOLS = new Set([
  'replace_string_in_file',
  'multi_replace_string_in_file',
  'create_file',
  'edit_notebook_file',
  'apply_patch',
]);

const chunks = [];

function buildVerifyMessage(toolName) {
  return {
    continue: true,
    systemMessage: [
      `Post-edit verification guard (triggered by ${toolName}):`,
      'You just edited or created a file. Before continuing to the next task step you MUST:',
      '1. Run get_errors on every file you changed or created in this burst.',
      '2. If the project has a linter or build command, run it to confirm zero new errors.',
      '3. If a local server is running, probe the affected route to confirm it still responds.',
      '4. If any check fails, fix the issue immediately before moving on.',
      'Do NOT skip verification. Do NOT batch multiple unverified edits.',
    ].join('\n'),
  };
}

function handleInput(raw) {
  if (!raw.trim()) {
    return { continue: true };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { continue: true };
  }

  const toolName =
    (parsed && parsed.toolName) ||
    (parsed && parsed.tool && parsed.tool.name) ||
    '';

  if (EDIT_TOOLS.has(toolName)) {
    return buildVerifyMessage(toolName);
  }

  return { continue: true };
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  const response = handleInput(chunks.join(''));
  process.stdout.write(JSON.stringify(response));
});
