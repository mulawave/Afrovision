/**
 * Pre-task-complete verification gate.
 *
 * Fires on PreToolUse for task_complete and forces the user to confirm
 * that verification was actually performed before the task is marked done.
 */

const chunks = [];

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

  if (toolName !== 'task_complete') {
    return { continue: true };
  }

  return {
    continue: true,
    systemMessage: [
      'VERIFICATION GATE — task_complete intercepted.',
      'Before this task is marked complete, confirm ALL of the following were done:',
      '• get_errors ran on every file created or modified — zero diagnostics.',
      '• Linter passed (if project has one).',
      '• Build succeeded (if project has a build step).',
      '• Affected routes/screens probed and responding correctly (if a server is running).',
      '• No regressions in adjacent files or features.',
      '',
      'If any step was skipped, cancel task_complete and perform verification first.',
    ].join('\n'),
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason:
        'Confirm that post-edit verification (diagnostics, lint, build, runtime) was completed before marking this task done.',
    },
  };
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  const response = handleInput(chunks.join(''));
  process.stdout.write(JSON.stringify(response));
});
