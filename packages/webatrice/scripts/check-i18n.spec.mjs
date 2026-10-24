// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  checkI18n, compareCatalogPaths, flattenCatalog, mergeCatalogs, readLanguageEnum, scanSource, serializeRollup,
  refreshLocaleBaseline,
} from './check-i18n.mjs';

const catalog = (json) => [{ file: 'src/A.i18n.json', json }];

const run = (overrides) => checkI18n({
  catalogFiles: catalog({ A: { title: 'Title' } }),
  sources: [{ file: 'src/A.tsx', text: 't(\'A.title\');' }],
  ...overrides,
});

describe('review regressions', () => {
  it.each([
    't(selected ? \'A.title\' : \'Typo.missing\');',
    't(\'A.title\' ?? \'Typo.missing\');',
    'const LABEL_KEYS = { title: \'A.title\' } as const; t(LABEL_KEYS[selected] ?? \'Typo.missing\');',
  ])('checks every branch of %s', (text) => {
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual(['src/A.ts:1: missing key "Typo.missing" (t())']);
  });

  it('keeps a partially unresolved branch dynamic', () => {
    expect(scanSource('src/A.ts', 't(key ?? \'A.title\');').dynamicCalls).toHaveLength(1);
  });

  it('resolves a nullable declared map alias used after a guard', () => {
    const text = 'const LABEL_KEYS: Record<number, string> = { 1: \'A.title\' }; '
      + 'const key = selected === null ? undefined : LABEL_KEYS[selected]; if (key) t(key);';
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual([]);
  });

  it('resolves typed uppercase maps and local aliases with computed properties', () => {
    const text = 'const FAILURE_KEYS: Record<Code, string> = { [Code.Bad]: \'A.title\' }; '
      + 'const key = FAILURE_KEYS[code]; t(key);';
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual([]);
  });

  it('resolves named and aliased exports through relative and app barrel imports', () => {
    const sources = [
      { file: 'src/keys/labels.ts', text: 'export const LABEL_KEYS: Record<string, string> = { title: \'A.title\' };' },
      { file: 'src/keys/index.ts', text: 'export { LABEL_KEYS as titleKeys } from \'./labels\';' },
      { file: 'src/A.ts', text: 'import { titleKeys as labels } from \'@app/keys\'; t(labels[selected]);' },
    ];
    expect(run({ sources })).toEqual([]);
    expect(run({ sources, catalogFiles: catalog({ A: { title: 'Title', unused: 'Unused' } }) }))
      .toEqual(['orphan key "A.unused" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)']);
    sources[0].text = sources[0].text.replace('A.title', 'Typo.missing');
    expect(run({ sources })).toContain('src/A.ts:1: missing key "Typo.missing" (t())');
  });

  it('handles export stars and local export aliases without looping through cycles', () => {
    const sources = [
      { file: 'src/keys.ts', text: 'const LABEL_KEYS = { title: \'A.title\' } as const; export { LABEL_KEYS as labels };' },
      { file: 'src/barrel.ts', text: 'export * from \'./keys\'; export * from \'./cycle\';' },
      { file: 'src/cycle.ts', text: 'export * from \'./barrel\';' },
      { file: 'src/A.ts', text: 'import { labels } from \'./barrel\'; t(labels[selected]);' },
    ];
    expect(run({ sources })).toEqual([]);
  });

  it('does not resolve non-exported or shadowed imported maps', () => {
    const sources = [
      { file: 'src/keys.ts', text: 'const LABEL_KEYS = { title: \'A.title\' } as const;' },
      { file: 'src/A.ts', text: 'import { LABEL_KEYS } from \'./keys\'; t(LABEL_KEYS[selected]);' },
    ];
    expect(run({ sources }).some((problem) => problem.includes('no declared domain'))).toBe(true);
    sources[0].text = `export ${sources[0].text}`;
    sources[1].text = 'import { LABEL_KEYS } from \'./keys\'; function f(LABEL_KEYS) { t(LABEL_KEYS[selected]); }';
    expect(run({ sources }).some((problem) => problem.includes('no declared domain'))).toBe(true);
  });

  it('normalises whitespace in unresolved expression signatures', () => {
    const [call] = scanSource('src/A.ts', 't(unknown\n ??\n fallback);').dynamicCalls;
    expect(call.expression).toBe('unknown ?? fallback');
    const baseline = { dynamicCalls: [{ file: 'src/A.ts', expression: 'unknown\n    ?? fallback', count: 1 }] };
    expect(run({ baseline, sources: [{ file: 'src/A.ts', text: 't(\'A.title\'); t(unknown ?? fallback);' }] })).toEqual([]);
  });

  it('orders source problems independently of input file order', () => {
    const sources = [
      { file: 'src/Z.ts', text: 't(\'A.missingZ\');' },
      { file: 'src/A.ts', text: 't(\'A.title\'); t(\'A.missingA\');' },
    ];
    expect(run({ sources })).toEqual(run({ sources: [...sources].reverse() }));
    expect(run({ sources })[0]).toContain('src/A.ts');
  });

  it('reports obsolete locale keys as stale rather than translation loss', () => {
    const baseline = { version: 1, locales: { de: { count: 2, keys: ['A.obsolete', 'A.title'] } } };
    const localeFiles = [{ locale: 'de', json: { A: { title: 'Titel' } } }];
    expect(run({ baseline, localeFiles })).toEqual(['scripts/i18n-baseline.json: de: stale baseline key "A.obsolete"']);
  });

  it('refreshes locale keys without dropping missing translations that still have defaults', () => {
    const baseline = { version: 1, locales: { de: { count: 2, keys: ['A.old', 'A.title'] } }, dynamicCalls: [] };
    const messages = { 'A.title': 'Title', 'A.new': 'New' };
    const localeFiles = [{ locale: 'de', json: { A: { old: 'Alt', new: 'Neu' } } }];
    const refreshed = refreshLocaleBaseline(localeFiles, baseline, messages);
    expect(refreshed).toEqual({ version: 1, locales: { de: { count: 2, keys: ['A.new', 'A.title'] } }, dynamicCalls: [] });
    expect(baseline.locales.de.keys).toEqual(['A.old', 'A.title']);
    expect(run({ catalogFiles: catalog({ A: { title: 'Title', new: 'New' } }), allowlist: ['A.new'],
      baseline: refreshed, localeFiles })).toEqual(['public/locales/de/: lost baseline translation "A.title"']);
  });

  it('preserves baseline locales with valid keys when a locale disappears', () => {
    const baseline = { version: 1, locales: { de: { count: 1, keys: ['A.title'] } } };
    expect(refreshLocaleBaseline([], baseline, { 'A.title': 'Title' })).toEqual(baseline);
    expect(() => refreshLocaleBaseline([], { version: 9 }, {})).toThrow('invalid completeness baseline');
  });
});

describe('flattenCatalog', () => {
  it('joins nested keys with dots', () => {
    expect(flattenCatalog({ A: { b: { c: 'x' }, d: 'y' } })).toEqual({ 'A.b.c': 'x', 'A.d': 'y' });
  });
});

describe('mergeCatalogs', () => {
  it('reports a namespace defined in two files', () => {
    const { problems } = mergeCatalogs([
      { file: 'one.i18n.json', json: { A: { x: '1' } } },
      { file: 'two.i18n.json', json: { A: { y: '2' } } },
    ]);
    expect(problems).toEqual(['two.i18n.json: namespace "A" is already defined in another *.i18n.json']);
  });
});

describe('scanSource', () => {
  it('collects t(), i18n.t(), i18nKey and *Key references', () => {
    const scan = scanSource('src/A.tsx', `
      t('A.one');
      i18n.t('A.two');
      const el = <Trans i18nKey="A.three" />;
      const entry = { labelKey: 'A.four' };
    `);
    expect(scan.keys.map((k) => [k.key, k.via])).toEqual([
      ['A.one', 't()'],
      ['A.two', 't()'],
      ['A.three', 'i18nKey'],
      ['A.four', 'labelKey'],
    ]);
  });

  it('records unresolved dynamic calls and defaultValue calls', () => {
    const scan = scanSource('src/A.ts', `
      t(\`A.column.\${c}\`);
      t(\`\${prefix}.count\`);
      t('A.title', { defaultValue: 'Title' });
    `);
    expect(scan.dynamicCalls.map((call) => call.expression)).toEqual(['`A.column.${c}`', '`${prefix}.count`']);
    expect(scan.defaultValues.map((d) => d.key)).toEqual(['A.title']);
  });
});

describe('readLanguageEnum', () => {
  it('reads the string values of the Language enum', () => {
    expect(readLanguageEnum('export enum Language { \'en_US\' = \'en_US\', \'de\' = \'de\' }')).toEqual(['en_US', 'de']);
  });
});

describe('checkI18n', () => {
  it('passes a catalogue whose keys are all used and defined', () => {
    expect(run({})).toEqual([]);
  });

  it('reports a literal key the catalogue does not define', () => {
    const problems = run({ sources: [{ file: 'src/A.tsx', text: 't(\'A.title\'); t(\'A.missing\');' }] });
    expect(problems).toEqual(['src/A.tsx:1: missing key "A.missing" (t())']);
  });

  it('ignores *Key values outside the catalogue namespaces', () => {
    expect(run({ sources: [{ file: 'src/A.ts', text: 't(\'A.title\'); const s = { storageKey: \'webatrice.x\' };' }] })).toEqual([]);
  });

  it.each(['\'A.missing\'', '`A.missing`'])('reports an expression-wrapped JSX key: %s', (expression) => {
    const sources = [{
      file: 'src/A.tsx',
      text: `t('A.title');\nconst el = <Trans i18nKey={${expression}} />;`,
    }];
    expect(run({ sources })).toEqual(['src/A.tsx:2: missing key "A.missing" (i18nKey)']);
  });

  it('checks expression-wrapped *Key props and accepts defined and dynamic JSX keys', () => {
    const sources = [{
      file: 'src/A.tsx',
      text: 'const el = <><Trans i18nKey={\'A.title\'} /><Label labelKey={\'A.missing\'} /><Trans i18nKey={key} /><Trans i18nKey /></>;',
    }];
    expect(run({ sources })).toEqual(['src/A.tsx:1: missing key "A.missing" (labelKey)']);
  });

  it('rejects a defaultValue on a catalogue key', () => {
    const problems = run({ sources: [{ file: 'src/A.tsx', text: 't(\'A.title\', { defaultValue: \'Title\' });' }] });
    expect(problems).toEqual([
      'src/A.tsx:1: "A.title" passes defaultValue, which hides a missing key; define it in the catalogue',
    ]);
  });

  it('requires a declared domain for template calls', () => {
    const problems = run({ sources: [{ file: 'src/A.tsx', text: 't(\'A.title\'); t(`A.column.${c}`);' }] });
    expect(problems).toEqual(['src/A.tsx:1: dynamic t() key has no declared domain: `A.column.${c}`']);
  });

  it('does not treat template prefixes or tails as usage', () => {
    const catalogFiles = catalog({
      A: {
        column: { name: 'Name' },
        steps: { one: 'One' },
        label: 'Label',
        confirm: { count: '{n} items' },
        preflight: 'Shown before i18next loads',
        orphan: 'Nobody renders this',
      },
    });
    const text = [
      't(`A.column.${c}`);',
      'const steps = keys.map((k) => `A.steps.${k}`);',
      'const entry = { label: \'A.label\', prefix: \'A.confirm\' };',
      't(`${prefix}.count`);',
    ].join('\n');
    const problems = run({ catalogFiles, sources: [{ file: 'src/A.tsx', text }], allowlist: ['A.preflight'] });
    expect(problems).toEqual([
      'src/A.tsx:1: dynamic t() key has no declared domain: `A.column.${c}`',
      'src/A.tsx:4: dynamic t() key has no declared domain: `${prefix}.count`',
      'orphan key "A.column.name" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)',
      'orphan key "A.steps.one" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)',
      'orphan key "A.confirm.count" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)',
      'orphan key "A.orphan" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)',
    ]);
  });

  it('reports an allowlisted key the catalogue no longer has', () => {
    expect(run({ allowlist: ['A.gone'] })).toEqual(['scripts/i18n-allowlist.json: "A.gone" is not a catalogue key']);
  });

  it('reports a message that is not valid ICU, ignoring <Trans> tags', () => {
    const catalogFiles = catalog({ A: { title: '<1>ok</1>', broken: '{count, plural, one {x}' } });
    const sources = [{ file: 'src/A.tsx', text: 't(\'A.title\'); t(\'A.broken\');' }];
    const problems = run({ catalogFiles, sources });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^"A.broken" is not valid ICU: /);
  });

  it('reports a stale rollup', () => {
    expect(run({ rollupText: serializeRollup({ A: { title: 'Old title' } }) })).toEqual([
      'src/i18n-default.json is stale; run `npm run translate` and commit the result',
    ]);
    expect(run({ rollupText: serializeRollup({ A: { title: 'Title' } }) })).toEqual([]);
  });

  it('reports a rollup whose keys are in another order, though nothing else changed', () => {
    const catalogFiles = [
      { file: 'src/A.i18n.json', json: { A: { title: 'Title' } } },
      { file: 'src/B.i18n.json', json: { B: { title: 'Other' } } },
    ];
    const sources = [{ file: 'src/A.tsx', text: 't(\'A.title\'); t(\'B.title\');' }];
    const reordered = serializeRollup({ B: { title: 'Other' }, A: { title: 'Title' } });
    expect(checkI18n({ catalogFiles, sources, rollupText: reordered })).toEqual([
      'src/i18n-default.json is stale; run `npm run translate` and commit the result',
    ]);
    const inOrder = serializeRollup({ A: { title: 'Title' }, B: { title: 'Other' } });
    expect(checkI18n({ catalogFiles, sources, rollupText: inOrder })).toEqual([]);
    expect(checkI18n({ catalogFiles, sources, rollupText: inOrder.replace(/\n/g, '\r\n') })).toEqual([]);
  });

  it('orders catalogue paths by code unit, not by locale', () => {
    expect(['src/b.i18n.json', 'src/B.i18n.json', 'src/a/z.i18n.json'].sort(compareCatalogPaths))
      .toEqual(['src/B.i18n.json', 'src/a/z.i18n.json', 'src/b.i18n.json']);
  });

  it('reports locale folders and Language values that do not match', () => {
    expect(run({ localeDirs: ['en_US', 'xx'], languages: ['en_US', 'de'] })).toEqual([
      'Language.de has no public/locales/de/ catalogue',
      'public/locales/xx/ has no Language enum value',
    ]);
  });
});

describe('declared key domains', () => {
  it('resolves a local const map used by a dynamic call', () => {
    const text = 'const titleKeys = { title: \'A.title\' } as const; t(titleKeys[selected]);';
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual([]);
  });

  it('checks every declared key, including unknown namespaces', () => {
    const text = 'const titleKeys = { title: \'A.title\', missing: \'Typo.missing\' } as const; t(titleKeys[selected]);';
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual(['src/A.ts:1: missing key "Typo.missing" (t())']);
  });

  it('reports an orphan alongside a declared domain', () => {
    const text = 'const titleKeys = { title: \'A.title\' } as const; t(titleKeys[selected]);';
    const problems = run({ catalogFiles: catalog({ A: { title: 'Title', unused: 'Unused' } }), sources: [{ file: 'src/A.ts', text }] });
    expect(problems).toEqual(['orphan key "A.unused" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)']);
  });

  it('does not count an unused key map as usage', () => {
    const text = 'const titleKeys = { title: \'A.title\' } as const;';
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual([
      'orphan key "A.title" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)',
    ]);
  });

  it('resolves only the selected key for literal map access', () => {
    const text = 'const titleKeys = { title: \'A.title\', missing: \'A.missing\' } as const; t(titleKeys[\'title\']);';
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual([]);
  });

  it.each([
    'let titleKeys = { title: \'A.title\' } as const; t(titleKeys[selected]);',
    'const titleKeys = { title: \'A.title\' }; t(titleKeys[selected]);',
    'const titleKeys = { ...other, title: \'A.title\' } as const; t(titleKeys[selected]);',
    'const titleKeys = { title: computed } as const; t(titleKeys[selected]);',
    'const titleKeys = { title: \'A.title\' } as const; function f(titleKeys) { t(titleKeys[selected]); }',
    'function f() { const titleKeys = { title: \'A.title\' } as const; } t(titleKeys[selected]);',
    'import { titleKeys } from \'./keys\'; t(titleKeys[selected]);',
    't(key);',
  ])('rejects an unresolved or unsafe declaration: %s', (text) => {
    expect(run({ sources: [{ file: 'src/A.ts', text }] }).some((problem) => problem.includes('no declared domain'))).toBe(true);
  });

  it('resolves the nearest declaration when maps share a name', () => {
    const text = [
      'const titleKeys = { title: \'A.title\' } as const;',
      'function f() { const titleKeys = { title: \'A.missing\' } as const; t(titleKeys[selected]); }',
      't(titleKeys[selected]);',
    ].join('\n');
    expect(run({ sources: [{ file: 'src/A.ts', text }] })).toEqual(['src/A.ts:2: missing key "A.missing" (t())']);
  });

  it('does not allow defaultValue to hide a declared key', () => {
    const text = 'const titleKeys = { title: \'A.title\' } as const; t(titleKeys[selected], { defaultValue: \'Title\' });';
    expect(run({ sources: [{ file: 'src/A.ts', text }] }).some((problem) => problem.includes('passes defaultValue'))).toBe(true);
  });
});

describe('locale completeness ratchet', () => {
  const baseline = { version: 1, locales: { de: { count: 1, keys: ['A.title'] } } };
  const localeFiles = [{ locale: 'de', json: { A: { title: 'Titel' } } }];

  it('accepts existing partial coverage', () => {
    expect(run({ localeFiles, baseline })).toEqual([]);
  });

  it('reports the intersection with defaults as coverage', () => {
    const localeReport = [];
    expect(run({ localeFiles: [{ locale: 'de', json: { A: { title: 'Titel', obsolete: 'Alt' } } }], baseline, localeReport })).toEqual([]);
    expect(localeReport).toEqual([{ locale: 'de', translated: 1, total: 1, baseline: 1 }]);
  });

  it('detects lost keys even when a replacement preserves the count', () => {
    expect(run({ localeFiles: [{ locale: 'de', json: { A: { other: 'Andere' } } }], baseline })).toEqual([
      'public/locales/de/: lost baseline translation "A.title"',
    ]);
  });

  it.each(['', '   ', null, 42])('rejects a baseline translation replaced by %j', (title) => {
    expect(run({ localeFiles: [{ locale: 'de', json: { A: { title } } }], baseline })).toEqual([
      'public/locales/de/: lost baseline translation "A.title"',
    ]);
  });

  it('allows new translations without demanding complete coverage', () => {
    expect(run({ localeFiles: [{ locale: 'de', json: { A: { title: 'Titel', other: 'Andere' } } }], baseline })).toEqual([]);
  });

  it('reports a removed locale and a missing baseline', () => {
    expect(run({ localeFiles: [], baseline })).toEqual(['public/locales/de/: baseline locale is missing']);
    expect(run({ localeFiles, baseline: { version: 1, locales: {} } })).toEqual(['public/locales/de/: completeness baseline is missing']);
  });

  it('reports translation loss in a locale folder with no catalogues', () => {
    expect(run({ localeFiles: [], localeDirs: ['de'], languages: ['de'], baseline })).toEqual([
      'public/locales/de/: lost baseline translation "A.title"',
    ]);
  });

  it.each([
    undefined,
    { version: 2, locales: {} },
    { version: 1, locales: { de: { count: 2, keys: ['A.title'] } } },
    { version: 1, locales: { de: { count: 2, keys: ['A.title', 'A.title'] } } },
    { version: 1, locales: { de: { count: 1, keys: [42] } } },
  ])('reports an invalid baseline: %j', (invalid) => {
    expect(run({ localeFiles, baseline: invalid })).toContain('scripts/i18n-baseline.json: invalid completeness baseline');
  });

  it('requires a new default key in the generated rollup, not in every locale', () => {
    const catalogFiles = catalog({ A: { title: 'Title', new: 'New' } });
    const sources = [{ file: 'src/A.ts', text: 't(\'A.title\'); t(\'A.new\');' }];
    const options = { catalogFiles, sources, localeFiles, baseline };
    expect(run({ ...options, rollupText: serializeRollup({ A: { title: 'Title' } }) })).toEqual([
      'src/i18n-default.json is stale; run `npm run translate` and commit the result',
    ]);
    expect(run({ ...options, rollupText: serializeRollup(catalogFiles[0].json) })).toEqual([]);
  });
});

describe('dynamic call ratchet', () => {
  const call = { file: 'src/A.ts', prefix: 'A.column.', count: 1 };
  const baseline = { dynamicCalls: [call] };
  const catalogFiles = catalog({ A: { column: { one: 'One', two: 'Two' } } });
  const sources = [{ file: 'src/A.ts', text: 't(`A.column.${selected}`);' }];
  const check = (options = {}) => run({ catalogFiles, sources, baseline, ...options });

  it('grandfathers existing prefixes without line-number churn', () => {
    expect(check()).toEqual([]);
    expect(check({ sources: [{ file: 'src/A.ts', text: '\n\nconst unrelated = 1;\nt(`A.column.${selected}`);' }] })).toEqual([]);
  });

  it('rejects a new prefix or a call in a different file', () => {
    expect(check({ sources: [...sources, { file: 'src/B.ts', text: 't(`A.column.${selected}`);' }] }))
      .toContain('src/B.ts:1: dynamic t() key has no declared domain: `A.column.${selected}`');
    expect(check({ sources: [{ file: 'src/A.ts', text: 't(`A.column.${selected}`); t(`A.other.${selected}`);' }] }))
      .toContain('src/A.ts:1: dynamic t() key has no declared domain: `A.other.${selected}`');
  });

  it('rejects an additional call sharing an existing prefix', () => {
    expect(check({ sources: [{ file: 'src/A.ts', text: sources[0].text.repeat(2) }] }))
      .toContain('src/A.ts:1: dynamic t() key has no declared domain: `A.column.${selected}`');
  });

  it('rejects a stale baseline entry after deletion or conversion', () => {
    expect(check({ sources: [] }).some((problem) => problem.includes('stale dynamic call'))).toBe(true);
    const converted = [{ file: 'src/A.ts', text: 'const columnKeys = { one: \'A.column.one\' } as const; t(columnKeys[selected]);' }];
    const problems = check({ sources: converted });
    expect(problems.some((problem) => problem.includes('stale dynamic call'))).toBe(true);
    expect(problems.some((problem) => problem.includes('orphan key "A.column.two"'))).toBe(true);
    expect(check({ sources: converted, baseline: { dynamicCalls: [] } })).toEqual([
      'orphan key "A.column.two" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)',
    ]);
  });

  it('requires the count to shrink when one of two calls disappears', () => {
    expect(check({ baseline: { dynamicCalls: [{ ...call, count: 2 }] } })
      .some((problem) => problem.includes('stale dynamic call'))).toBe(true);
  });

  it('does not give unknown expressions a global prefix exemption', () => {
    const options = { sources: [{ file: 'src/A.ts', text: 't(key);' }],
      baseline: { dynamicCalls: [{ file: 'src/A.ts', expression: 'key', count: 1 }] } };
    expect(check(options)).toHaveLength(2);
    expect(check(options).every((problem) => problem.startsWith('orphan key'))).toBe(true);
  });

  it('preserves exact tail matching without treating an empty prefix as a wildcard', () => {
    const sources = [{ file: 'src/A.ts', text: 'const key = \'A.column\'; t(`${key}.one`);' }];
    const baseline = { dynamicCalls: [{ file: 'src/A.ts', prefix: '', tail: '.one', count: 1 }] };
    expect(check({ sources, baseline })).toEqual([
      'orphan key "A.column.two" is never referenced (delete it, or list it in scripts/i18n-allowlist.json)',
    ]);
  });

  it('keeps non-template signatures stable across whitespace edits', () => {
    const text = 't(\n entry.label\n);';
    const baseline = { dynamicCalls: [{ file: 'src/A.ts', expression: 'entry.label', count: 1 }] };
    expect(run({ sources: [{ file: 'src/A.ts', text: `${text} t('A.title');` }], baseline })).toEqual([]);
  });

  it('only preserves a separately recorded indirect template while its producer exists', () => {
    const baseline = { dynamicCalls: [], dynamicTemplates: [{ file: 'src/A.ts', prefix: 'A.column.', count: 1 }] };
    const sources = [{ file: 'src/A.ts', text: 'const key = `A.column.${selected}`;' }];
    expect(check({ sources, baseline })).toEqual([]);
    expect(check({ sources: [], baseline }).some((problem) => problem.includes('stale dynamic template'))).toBe(true);
    expect(check({ sources, baseline: { dynamicCalls: [] } })).toHaveLength(2);
  });

  it.each([
    [{ ...call, count: 0 }],
    [{ ...call, count: -1 }],
    [{ ...call, count: 1.5 }],
    [{ prefix: 'A.column.', count: 1 }],
    [call, call],
    [{ ...call, expression: 'key' }],
  ])('rejects malformed or duplicate entries: %j', (dynamicCalls) => {
    expect(check({ baseline: { dynamicCalls } }))
      .toContain('scripts/i18n-baseline.json: invalid dynamic baseline');
  });
});
