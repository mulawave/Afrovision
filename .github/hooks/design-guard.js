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

function buildStatefulInteractiveRule() {
  return [
    '⚠️ MANDATORY — Stateful Interactive Elements (highest priority, never skip):',
    'Every button, link, menu item, icon-button, FAB, card-tap, and interactive element MUST be stateful:',
    '  1. LOADING state: show a spinner (CircularProgressIndicator / loading spinner) and disable the element while an async action is in flight.',
    '  2. DISABLED state: visually dim and ignore taps when the action is unavailable or already running.',
    '  3. SUCCESS state: brief visual confirmation (checkmark, color flash, snackbar) after the action completes.',
    '  4. ERROR state: show inline error feedback or a snackbar/toast; never silently swallow failures.',
    '  5. For Flutter: wrap tap handlers so they set a local `_isLoading` flag, await the future, then clear the flag in a finally block. Use `AbsorbPointer` or `IgnorePointer` + opacity to disable during loading.',
    '  6. For React/Next.js: maintain `loading` state, pass `disabled={loading}` to the element, and render a spinner inside the element while loading. Use try/finally to always clear loading state.',
    '  7. Submit buttons must replace their label with a compact spinner (same size as text) during loading — never leave a button looking clickable while work is happening.',
    '  8. Navigation links/menu items that trigger async work (logout, delete, fetch) must also show loading state.',
    '  9. If a component already exists without these states, ADD them as part of any edit touching that component.',
    '  10. This rule applies to ALL implementations, fixes, and edits — no exceptions, no deferral, no "will add later".'
  ].join('\n');
}

function buildReminderResponse() {
  return {
    continue: true,
    systemMessage: [
      buildStatefulInteractiveRule(),
      '',
      'Design coherence guard:',
      '- Keep new UI aligned with AfroVision\'s default dark premium theme and existing visual precedents.',
      '- Use AppColors only, keep screen gradients where required, and reuse shared widgets before inventing new patterns.',
      '- Preserve strong hierarchy, spacing, shadows, animation, and interaction-state styling.',
      '- Use /design-coherence-guard during implementation and /design-coherence-review before merge when visual consistency matters.'
    ].join('\n')
  };
}

function buildBlockResponse() {
  return {
    continue: false,
    stopReason: 'Request conflicts with the workspace design system and asks for off-theme UI behavior.',
    systemMessage: [
      'Design coherence guard blocked this request.',
      '- The prompt appears to ask for UI that conflicts with AfroVision\'s default theme, color system, or component standards.',
      '- Rephrase the request to stay within AppColors, the premium dark theme, required gradients, shared widgets, and consistent interaction states.',
      '- If a real exception is needed, state the justification explicitly instead of asking for generic or off-brand styling.',
      '- Use /design-coherence-guard to structure the request within the project design system.'
    ].join('\n')
  };
}

function buildDefaultResponse() {
  return { continue: true };
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function shouldBlockOffThemeRequest(haystack) {
  const offThemePhrases = [
    'light theme',
    'white background',
    'plain white',
    'purple theme',
    'pink theme',
    'neon theme',
    'random colors',
    'use any colors',
    'hardcode colors',
    'ignore appcolors',
    'ignore the theme',
    'ignore theme',
    'ignore design system',
    'skip the gradient',
    'no gradient',
    'remove the gradient',
    'generic ui',
    'basic ui',
    'default material',
    'material default',
    'unstyled',
    'no animation',
    'skip animation',
    'no need for animation',
    'temporary styling',
    'placeholder styling',
    'quick styling',
    'just make it simple',
    'ignore responsiveness',
    'desktop only styling',
    'mobile only styling',
    'use inline colors'
  ];

  const offThemePatterns = [
    /\b(use|make|switch to|change to)\b.*\b(light|white|purple|pink|neon)\s+(theme|background|palette|colors?)\b/,
    /\b(ignore|skip|remove)\b.*\b(gradient|theme|design system|appcolors|animations?|responsive|responsiveness)\b/,
    /\b(use|allow)\b.*\b(any|random|custom|hardcoded|inline)\s+(colors?|palette)\b/,
    /\b(default|generic|basic)\b.*\b(material|ui|styling|theme)\b/
  ];

  return includesAny(haystack, offThemePhrases) || offThemePatterns.some((pattern) => pattern.test(haystack));
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

  const designKeywords = [
    'ui',
    'ux',
    'design',
    'theme',
    'color',
    'colors',
    'gradient',
    'screen',
    'page',
    'widget',
    'panel',
    'dropdown',
    'dialog',
    'layout',
    'style',
    'visual',
    'component'
  ];

  const isDesignRelated = designKeywords.some((keyword) => haystack.includes(keyword));
  const shouldBlock = isDesignRelated && shouldBlockOffThemeRequest(haystack);

  if (shouldBlock) {
    return buildBlockResponse();
  }

  // Full design reminder (theme + stateful) for design-related prompts
  if (isDesignRelated) {
    return buildReminderResponse();
  }

  // Stateful interactive rule fires on EVERY prompt — never skip
  return {
    continue: true,
    systemMessage: buildStatefulInteractiveRule()
  };
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  const response = handleInput(chunks.join(''));
  process.stdout.write(JSON.stringify(response));
});