// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const sourceRoots = [path.resolve(__dirname, '../features/game')];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ['__test-utils__', '__mocks__'].includes(entry.name) ? [] : sourceFiles(file);
    }
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.spec.tsx') ? [file] : [];
  });
}

const policy = readFileSync(path.resolve(__dirname, 'board-motion.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const coveredClasses = new Set<string>();
for (const [, selectors, declarations] of policy.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  if (/(?:transition|animation)\s*:\s*none\s*;/.test(declarations)) {
    for (const selector of selectors.split(',')) {
      const match = selector.trim().match(/^:root\[data-animations=['"]off['"]\]\s+\.([\w-]+)$/);
      if (match) {
        coveredClasses.add(match[1]);
      }
    }
  }
}

function uncoveredStrings(source: string): string[] {
  const problems: string[] = [];
  const literals = /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\r\n])*'|"(?:\\.|[^"\\\r\n])*"|`(?:\\.|[^`\\])*`/g;
  for (const match of source.matchAll(literals)) {
    if (match[0].startsWith('/')) {
      continue;
    }
    const value = match[0].slice(1, -1);
    const classes = value.split(/[\s'"`]+/);
    const owners = match[0].startsWith('`') ? value.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/) : classes;
    const hasMotion = classes.some((token) => /(?:^|:)!?(?:transition(?:-\S+)?|animate-\S+|duration-\S+)!?$/.test(token));
    if (hasMotion && !owners.some((token) => coveredClasses.has(token))) {
      const line = source.slice(0, match.index).split('\n').length;
      problems.push(`${line}: ${value.trim()}`);
    }
  }
  return problems;
}

describe('board motion ownership guard', () => {
  it.each([
    'transition', 'transition-colors', 'transition-[width,padding]',
    'hover:transition-transform', 'motion-safe:animate-spin', 'animate-[pulse_1s]',
    'duration-200', 'md:!duration-[250ms]',
  ])('rejects an uncovered %s class', (utility) => {
    expect(uncoveredStrings(`<div className="${utility}" />`)).toHaveLength(1);
    expect(uncoveredStrings(`<div className="board-motion ${utility}" />`)).toEqual([]);
  });

  it.each([
    'const classes = [\'board-motion\', \'duration-200\'].join(\' \');',
    'const classes = \'p-2 \' + \'animate-spin\';',
    'const classes = `duration-${duration}`;',
    'const classes = `${active ? \'animate-spin\' : \'\'}`;',
    'const classes = `${active ? \'board-motion\' : \'\'} transition`;'
  ])('checks assembled class strings: %s', (source) => {
    expect(uncoveredStrings(source)).toHaveLength(1);
  });

  it('accepts a template with an unconditional covered owner', () => {
    expect(uncoveredStrings('const classes = `board-motion ${active ? \'animate-spin\' : \'\'}`;')).toEqual([]);
  });

  it('recognizes existing covered owners and ignores comments, but not an uncovered sibling', () => {
    expect(uncoveredStrings(`
      // 'animate-spin' is an example, not an owner.
      /* className="duration-100" */
      <div className="seat-card transition-transform duration-150" />
      <div className="phase-endstep-flash animate-pulse" />
      <div className="animate-spin" />
    `)).toEqual(['6: animate-spin']);
  });

  it('covers every motion class string in production game TSX', () => {
    const files = sourceRoots.flatMap(sourceFiles);
    expect(files.length).toBeGreaterThan(0);
    expect(coveredClasses.has('board-motion')).toBe(true);
    const problems = files.flatMap((file) => uncoveredStrings(readFileSync(file, 'utf8'))
      .map((problem) => `${path.relative(sourceRoots[0], file).replaceAll('\\', '/')}:${problem}`));
    expect(problems, 'Add board-motion to each animation owner (including portals).').toEqual([]);
  });
});
