import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import config from '../eslint.config.mjs';

const eslint = new ESLint({ cache: false, overrideConfigFile: true, overrideConfig: config });
const hook = 'src/hooks/useI18nFixture.ts';
const rule = 'local-i18n/no-untranslated-text';

beforeAll(async () => {
  await eslint.calculateConfigForFile(hook);
}, 60000);

async function errors(code, filePath = hook) {
  const [result] = await eslint.lintText(`${code}\n`, { filePath });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages.filter((message) => message.ruleId === rule);
}

describe('non-JSX user-visible text', () => {
  it('checks callback text within JSX at the nearest function boundary', async () => {
    expect(await errors('const button = <B onClick={() => enqueueSnackbar(\'Saved now\')} />;',
      'src/components/I18nFixture.tsx')).toHaveLength(1);
  });

  it('checks quoted aria labels in object literals', async () => {
    expect(await errors('const props = { \'aria-label\': \'Save changes\' };')).toHaveLength(1);
  });

  it('excludes direct logger payloads and identifier-shaped title data', async () => {
    expect(await errors('debug({ message: \'Request failed\' });')).toEqual([]);
    expect(await errors('const metadata = { title: \'commander\' };')).toEqual([]);
    expect(await errors('const props = { \'aria-label\': \'commander\' };')).toHaveLength(1);
    expect(await errors('enqueueSnackbar(\'commander\');')).toHaveLength(1);
    expect(await errors('openPrompt({ title: \'commander\' });')).toHaveLength(1);
  });

  it('checks text inside callbacks passed to a logger', async () => {
    expect(await errors('logger.debug(() => { enqueueSnackbar(\'Saved now\'); });')).toHaveLength(1);
  });

  it.each([
    'const message = \'Connection failed\';',
    'const label = \'Save\';',
    'const item = { label: \'Open\' };',
    'const item = { title: `Hello ${name}` };',
    'const item = { message: ok ? \'Ready\' : \'Try again\' };',
    'setMessage(\'Connection failed\');',
    'setError(\'email\', { message: \'Enter an email address\' });',
    'enqueueSnackbar(\'Saved\');',
    'toast.error(\'Failed\');',
    'window.alert(\'Disconnected\');',
    'const title = \'Player \' + name;',
    'const placeholder = \'Search\' as const;',
    'const errorMessage = error.message || \'Try again\';',
    'function getLabel() { return \'Open\'; }',
    'z.string().min(1, \'Required\');',
    'const prompt = { validate: (value) => value ? null : \'Enter a number\' };',
    'const prompt = { validate: (value) => { return value ? null : \'Enter a number\'; } };',
    'const [label, setLabel] = useState(\'Save\');',
  ])('reports %s', async (code) => {
    expect(await errors(code)).not.toHaveLength(0);
  });

  it('also checks non-JSX text in TSX files', async () => {
    expect(await errors('const label = \'Save\';', 'src/components/I18nFixture.tsx')).toHaveLength(1);
  });

  it.each([
    'const label = t(\'A.label\');',
    'const item = { label: i18n.t(\'A.label\') };',
    'const kind = \'ready\'; const id = \'user-menu\';',
    'const item = { type: \'notice\', testId: \'user-menu\', labelKey: \'A.label\', url: \'https://example.com\' };',
    'enum State { Ready = \'Ready\' }',
    'type Label = \'Save\' | \'Open\';',
    'console.warn({ message: \'Connection failed\' });',
    'logger.error({ message: \'Connection failed\' });',
    'const labels = { ready: \'A.ready\' } as const; t(labels[state]);',
    'setError(\'email\', { type: \'required\', message: t(\'A.required\') });',
    'document.querySelector(\'[data-testid=menu]\');',
    'const title = \'https://example.com\';',
    'const title = \'123\';',
    'const message = new Error(\'Internal invariant\');',
    'const item = { label: \'UserMenu.account\', text: \'text-success\' };',
    'const label = `CardImport.steps.${step}`;',
    'const titleKeys = { title: \'A.title\' } as const; t(titleKeys[selected]);',
    'const description = `<p>${value}</p>`;',
    'const [message, setMessage] = useState<\'joining\' | \'loading\'>(\'joining\');',
    'type Message = \'joining\' | \'loading\'; const [message, setMessage] = useState<Message | null>(null); setMessage(\'joining\');',
  ])('excludes technical or translated text: %s', async (code) => {
    expect(await errors(code)).toEqual([]);
  });

  it.each([
    'src/hooks/useI18nFixture.spec.ts',
    'src/hooks/useI18nFixture.test.ts',
    'src/__test-utils__/i18nFixture.ts',
    'src/hooks/__mocks__/i18nFixture.ts',
  ])('excludes %s', async (filePath) => {
    expect(await errors('const label = \'Save\';', filePath)).toEqual([]);
  });

  it('leaves JSX checking to i18next', async () => {
    const [result] = await eslint.lintText('const item = <button title="Open">Save</button>;\n', {
      filePath: 'src/components/I18nFixture.tsx',
    });
    expect(result.messages.filter((message) => message.ruleId === rule)).toEqual([]);
    expect(result.messages.filter((message) => message.ruleId === 'i18next/no-literal-string')).toHaveLength(2);
  });

  it('keeps single-word labels checked when technical strings are excluded', async () => {
    expect(await errors('setMessage(\'Joining\');')).toHaveLength(1);
    expect(await errors('const label = \'Ready\';')).toHaveLength(1);
    expect(await errors('const description = \'<p>Save changes</p>\';')).toHaveLength(1);
  });
});
