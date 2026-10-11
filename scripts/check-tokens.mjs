#!/usr/bin/env node
/**
 * The design token drift check.
 *
 * Runs in about a second and fails when a colour, type size, spacing step or
 * corner radius lands in `src/` instead of in `src/global.css`. It is the only
 * reason the design system survives features 8 through 12: a document asks
 * nicely, a check that exits non zero does not.
 *
 *   npm run check:tokens
 *
 * What it is NOT: this is a grep. It catches SHAPES, not meaning. A class name
 * that looks like a token but was never declared (`text-huge`) passes this
 * check and renders nothing at all. Feature 2 can promote it into a real
 * ESLint rule once that feature runs.
 *
 * Adding to the allow list is a deliberate act. Every entry carries a reason,
 * and "it was quicker" is not one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIR = join(ROOT, 'src');
const EXTENSIONS = ['.ts', '.tsx'];

/**
 * Each rule is a shape that means a value escaped `global.css`.
 *
 * Sizes (`w-[48px]`, `min-h-[52px]`) are deliberately NOT here. A touch target
 * is a measurement against the 48dp rule, not a step on the spacing scale, and
 * forcing those through tokens would invent a scale nobody reads.
 */
const RULES = [
  {
    id: 'arbitrary-type-size',
    pattern: /\btext-\[/,
    message: 'arbitrary type size. Use text-label, text-body, text-title or text-verdict.',
  },
  {
    id: 'off-scale-type-size',
    pattern: /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/,
    message: 'off scale type size. The scale is exactly four: text-label, text-body, text-title, text-verdict.',
  },
  {
    id: 'arbitrary-line-height',
    pattern: /\bleading-\[/,
    message: 'arbitrary line height. Every type token already carries its own line height.',
  },
  {
    id: 'arbitrary-colour',
    pattern: /\b(bg|text|border|outline|fill|stroke|from|via|to)-\[#/,
    message: 'arbitrary colour. Declare it in src/global.css and use the token.',
  },
  {
    id: 'arbitrary-radius',
    pattern: /\brounded(-[a-z]{1,2})?-\[/,
    message: 'arbitrary corner radius. Use rounded-bar, -tile, -thumb, -card, -frame or -button.',
  },
  {
    id: 'arbitrary-spacing',
    pattern: /\b(p|m)[xytblre]?-\[/,
    message: 'arbitrary padding or margin. Use the 4px scale: 1, 2, 3, 4, 6, 8.',
  },
  {
    id: 'arbitrary-gap',
    pattern: /\bgap(-[xy])?-\[/,
    message: 'arbitrary gap. Use the 4px scale: 1, 2, 3, 4, 6, 8.',
  },
  {
    id: 'font-scaling-disabled',
    pattern: /allowFontScaling\s*=?\s*\{?\s*false/,
    message: 'allowFontScaling must never be false. A person who needs large text gets clipped words.',
  },
  {
    /*
     * The dangerous shape is a class NAME completed by interpolation
     * (`bg-surface-${kind}`), which Tailwind cannot see and which therefore
     * renders nothing, with no error. Interpolating a whole class STRING from
     * a literal map (`${CARD[kind]}`) is the sanctioned pattern and must not
     * trip this, so the `${` has to follow a class name character to count.
     */
    id: 'interpolated-class-name',
    pattern: /className=\{`[^`]*[a-z0-9]-\$\{/,
    message: 'class name completed by interpolation. Tailwind only sees class names written out literally, so this silently renders nothing. Use a literal class map.',
  },
  {
    id: 'unwrapped-rn-import',
    pattern: /^import\s*\{[^}]*\b(View|Text|Pressable|ScrollView|Image)\b[^}]*\}\s*from\s*'react-native'/,
    message: "import from '@/tw', not 'react-native'. The react-native original takes no className and fails silently.",
  },
];

/**
 * The written allow list. Every entry needs a file, the exact text that is
 * allowed, and a reason a stranger would accept.
 */
const ALLOW = [
  {
    file: 'src/screens/scan/index.tsx',
    match: 'border-[#FFFFFFE6]',
    reason:
      'The viewfinder framing corners sit over live video, not over an app surface, so they answer to the camera image rather than to the palette. A token here would be a lie about where the value comes from.',
  },
  {
    file: 'src/components/loading-overlay.tsx',
    match: 'bg-[#00000099]',
    reason:
      'The reading scrim darkens live camera video. Same reason as the framing corners: it is calibrated against the photographed scene, not against --color-background.',
  },
  {
    file: 'src/components/loading-overlay.tsx',
    match: 'border-[#FFFFFFBF]',
    reason: 'The ring inside the scrim, over live video. Calibrated against the scrim, not the palette.',
  },
  {
    file: 'src/components/loading-overlay.tsx',
    match: 'text-[#FFFFFFD9]',
    reason: 'The sub line inside the scrim, over live video. Calibrated against the scrim, not the palette.',
  },
];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return EXTENSIONS.some((ext) => entry.endsWith(ext)) ? [full] : [];
  });
}

/** An allow list entry only excuses the exact text, in the exact file. */
function isAllowed(relPath, line) {
  return ALLOW.some((entry) => entry.file === relPath && line.includes(entry.match));
}

/**
 * The one rule that lives in `global.css` itself rather than in `src/`.
 *
 * A `--text-*--line-height` companion has to be a unitless ratio. Write it as
 * a px length and Tailwind still compiles, the bundler still reports zero
 * errors, and every piece of text on the phone silently gets a line height of
 * `companion x font size`: 24px on `text-body` became 408dp of line box, which
 * pushed siblings off screen and gave the verdict word a NEGATIVE height. The
 * reason is in the type scale comment in `src/global.css`.
 *
 * This is the whole regression guard for that bug, so it is deliberately
 * narrow: it looks for a unit on a line height companion and nothing else.
 */
function lineHeightFindings() {
  const relPath = 'src/global.css';

  return readFileSync(join(ROOT, relPath), 'utf8')
    .split('\n')
    .flatMap((line, index) => {
      const match = /--text-[\w-]*--line-height:\s*([^;]+);/.exec(line);
      if (!match || !/\d\s*(px|rem|em|pt)\b/.test(match[1])) return [];

      return [
        {
          where: `${relPath}:${index + 1}`,
          rule: 'px-line-height-companion',
          message:
            'line height companion carries a unit. It must be a unitless ratio, e.g. calc(34 / 28), because react-native-css multiplies this value by the font size. A px value here renders silently at 34 x 28 = 952dp.',
          line: line.trim(),
        },
      ];
    });
}

const findings = lineHeightFindings().concat(sourceFiles(SCAN_DIR).flatMap((file) => {
  const relPath = relative(ROOT, file).split(sep).join('/');

  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, index) => {
      if (isAllowed(relPath, line)) return [];

      return RULES.filter((rule) => rule.pattern.test(line)).map((rule) => ({
        where: `${relPath}:${index + 1}`,
        rule: rule.id,
        message: rule.message,
        line: line.trim(),
      }));
    });
}));

if (findings.length === 0) {
  console.log(
    `check:tokens  no drift in ${sourceFiles(SCAN_DIR).length} files` +
      (ALLOW.length ? `, ${ALLOW.length} allow list entries` : '')
  );
  process.exit(0);
}

console.error(`check:tokens  ${findings.length} value(s) outside the design system\n`);
for (const finding of findings) {
  console.error(`  ${finding.where}`);
  console.error(`    ${finding.message}`);
  console.error(`    ${finding.line}\n`);
}
console.error('Declare the value in src/global.css, or add it to the allow list in');
console.error('scripts/check-tokens.mjs with a reason.');
process.exit(1);
