const chunks = [];

function collectStrings(value, results) {
  if (typeof value === 'string') {
    results.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, results);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const nestedValue of Object.values(value)) {
    collectStrings(nestedValue, results);
  }
}

function buildReminderResponse() {
  return {
    continue: true,
    systemMessage: [
      'Implementation completeness guard:',
      '- Treat feature work as end-to-end, not as a partial slice.',
      '- Cover entry points, destination surfaces, wiring, navigation, loading, empty, error, success, offline, disabled, validation, and permission states.',
      '- Include supporting flows and management controls that users need to operate the feature.',
      '- If a blocker prevents full delivery, state the blocker clearly instead of presenting the feature as complete.',
      '- Use /implementation-guard for guided implementation and /implementation-completeness-review before calling work done.'
    ].join('\n')
  };
}

function buildBlockResponse() {
  return {
    continue: false,
    stopReason: 'Request asks for a partial implementation slice that conflicts with the workspace end-to-end standard.',
    systemMessage: [
      'Implementation completeness guard blocked this request.',
      '- The prompt appears to ask for only part of a feature or flow.',
      '- AfroVision standards require end-to-end delivery across entry points, destination surfaces, wiring, states, validation, and management actions.',
      '- Rephrase the request as a complete feature flow or explicitly state the real blocker preventing full delivery.',
      '- Use /implementation-guard to structure the full implementation request.'
    ].join('\n')
  };
}

function buildDefaultResponse() {
  return { continue: true };
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function shouldBlockPartialImplementation(haystack) {
  const partialPhrases = [
    'just add',
    'just build',
    'just create',
    'just implement',
    'just make',
    'just wire',
    'only the ui',
    'ui only',
    'frontend only',
    'front end only',
    'backend only',
    'api only',
    'only the backend',
    'only the api',
    'only the icon',
    'just the icon',
    'only the button',
    'just the button',
    'page shell',
    'button shell',
    'screen shell',
    'just scaffold',
    'scaffold only',
    'create a scaffold',
    'create a skeleton',
    'placeholder',
    'stub it',
    'mock it',
    'coming soon',
    'do the rest later',
    'ignore the states',
    'ignore states',
    'skip validation',
    'no need for backend',
    'no need for frontend',
    'no need for ui',
    'no need for the page',
    'no need for the flow'
  ];

  const partialPatterns = [
    /\bonly\s+(the\s+)?(ui|frontend|front end|backend|api|icon|button|screen|page|panel|dropdown)\b/,
    /\bjust\s+(the\s+)?(ui|frontend|front end|backend|api|icon|button|screen|page|panel|dropdown)\b/,
    /\b(scaffold|skeleton|placeholder|stub|mock)\b/,
    /\b(ignore|skip)\b.*\b(states?|validation|permissions?|backend|frontend|ui|api|flow|flows|management)\b/
  ];

  return includesAny(haystack, partialPhrases) || partialPatterns.some((pattern) => pattern.test(haystack));
}

function handleInput(rawInput) {
  if (!rawInput.trim()) {
    return buildDefaultResponse();
  }

  let parsedInput;
  try {
    parsedInput = JSON.parse(rawInput);
  } catch {
    parsedInput = rawInput;
  }

  const collectedStrings = [];
  collectStrings(parsedInput, collectedStrings);
  const haystack = collectedStrings.join(' ').toLowerCase();

  const implementationKeywords = [
    'implement',
    'implementation',
    'feature',
    'flow',
    'screen',
    'page',
    'function',
    'build',
    'create',
    'add',
    'wire',
    'notification',
    'dropdown',
    'panel'
  ];

  const shouldRemind = implementationKeywords.some((keyword) => haystack.includes(keyword));
  const shouldBlock = shouldRemind && shouldBlockPartialImplementation(haystack);

  if (shouldBlock) {
    return buildBlockResponse();
  }

  return shouldRemind ? buildReminderResponse() : buildDefaultResponse();
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  const response = handleInput(chunks.join(''));
  process.stdout.write(JSON.stringify(response));
});