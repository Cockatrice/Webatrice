// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) });
const component = 'src/features/game/components/SeamFixture.ts';
const hook = 'src/features/game/hooks/useSeamFixture.ts';
const barrel = 'src/services/seamFixture.ts';
const rules = new Set(['@typescript-eslint/no-restricted-imports', 'no-restricted-syntax']);

beforeAll(async () => {
  await eslint.calculateConfigForFile(component);
}, 60000);

async function seamErrors(code, filePath) {
  const [result] = await eslint.lintText(`${code}\n`, { filePath });
  expect(result.fatalErrorCount).toBe(0);
  return result.messages.filter((message) => rules.has(message.ruleId));
}

describe.each([component, hook])('game command seam in %s', (filePath) => {
  it.each([
    'import { useWebClient as client } from \'@cockatrice/datatrice/react\';',
    'import { WebClientContext as context } from \'@cockatrice/datatrice/react\';',
    'import * as react from \'@cockatrice/datatrice/react\';',
    'export { useWebClient as client } from \'@cockatrice/datatrice/react\';',
    'export * from \'@cockatrice/datatrice/react\';',
    'import { WebClient as Client } from \'@cockatrice/sockatrice\';',
    'import * as socket from \'@cockatrice/sockatrice\';',
    'export { WebClient as Client } from \'@cockatrice/sockatrice\';',
    'export * from \'@cockatrice/sockatrice\';',
    'import(\'@cockatrice/datatrice/react\');',
    'import(\'@cockatrice/sockatrice\');',
    'require(\'@cockatrice/datatrice/react\');',
    'require(\'@cockatrice/sockatrice\');',
  ])('rejects %s', async (code) => {
    expect(await seamErrors(code, filePath)).not.toHaveLength(0);
  });

  it('allows type-only WebClient imports', async () => {
    expect(await seamErrors('import type { WebClient } from \'@cockatrice/sockatrice\';', filePath)).toEqual([]);
  });
});

describe('forwarding barrels outside the game seam', () => {
  it.each([
    'export { useWebClient as client } from \'@cockatrice/datatrice/react\';',
    'export { WebClientContext as context } from \'@cockatrice/datatrice/react\';',
    'export * from \'@cockatrice/datatrice/react\';',
    'export * as client from \'@cockatrice/datatrice/react\';',
  ])('rejects %s', async (code) => {
    expect(await seamErrors(code, barrel)).not.toHaveLength(0);
  });

  it('allows a command port to import the hook', async () => {
    expect(await seamErrors('import { useWebClient } from \'@cockatrice/datatrice/react\';',
      'src/features/game/components/ui/GameBoardCell/usePlayerTargetCommands.ts')).toEqual([]);
  });
});
