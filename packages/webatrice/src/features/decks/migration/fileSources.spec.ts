import { fromDataTransfer, fromInputFiles } from './fileSources';

it('uses the folder-relative path of picked files', () => {
  const file = new File(['x'], 'burn.cod');
  Object.defineProperty(file, 'webkitRelativePath', { value: 'Cockatrice/decks/burn.cod' });
  expect(fromInputFiles([file, new File(['y'], 'loose.txt')]).map((s) => s.path))
    .toEqual(['Cockatrice/decks/burn.cod', 'loose.txt']);
});

it('walks dropped folders', async () => {
  const burn = new File(['x'], 'burn.cod');
  const fileEntry = (file: File, fullPath: string) => ({
    isFile: true, isDirectory: false, fullPath, file: (ok: (f: File) => void) => ok(file),
  });
  const batches = [[fileEntry(burn, '/Cockatrice/decks/burn.cod')], []];
  const dir = {
    isFile: false, isDirectory: true, fullPath: '/Cockatrice',
    createReader: () => ({ readEntries: (ok: (entries: unknown[]) => void) => ok(batches.shift() ?? []) }),
  };
  const data = { items: [{ kind: 'file', webkitGetAsEntry: () => dir }], files: [] } as unknown as DataTransfer;
  expect((await fromDataTransfer(data)).map((s) => s.path)).toEqual(['Cockatrice/decks/burn.cod']);
});
