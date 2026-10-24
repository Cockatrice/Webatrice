import assert from 'node:assert/strict';
import test from 'node:test';
import { findPathCaseClashes } from './check-path-case.mjs';

test('rejects tracked filenames differing only in case', () => {
  assert.deepEqual(findPathCaseClashes(['src/Foo.ts', 'src/foo.ts']), [
    'Path case clash: "src/Foo.ts" / "src/foo.ts"',
  ]);
});

test('rejects differently cased directories with distinct children once', () => {
  assert.deepEqual(findPathCaseClashes(['Foo/a.ts', 'foo/b.ts', 'foo/c.ts', 'Foo/d.ts']), [
    'Path case clash: "Foo" / "foo"',
  ]);
});

test('rejects nested directory and file/directory case collisions', () => {
  assert.deepEqual(findPathCaseClashes(['src/Foo', 'src/foo/b.ts']), [
    'Path case clash: "src/Foo" / "src/foo"',
  ]);
});

test('rejects differently cased stems across extensions', () => {
  assert.deepEqual(findPathCaseClashes([
    'components/ManaSymbols/ManaSymbols.tsx',
    'components/ManaSymbols/manaSymbols.ts',
  ]), [
    'Stem case clash: "components/ManaSymbols/ManaSymbols.tsx" / "components/ManaSymbols/manaSymbols.ts"',
  ]);
});

test('allows identical-case stems across extensions', () => {
  assert.deepEqual(findPathCaseClashes(['Foo.tsx', 'Foo.css', 'Foo']), []);
});

test('keeps stems scoped to their directory', () => {
  assert.deepEqual(findPathCaseClashes(['a/Foo.tsx', 'b/foo.ts']), []);
});

test('handles empty input and repeated paths', () => {
  assert.deepEqual(findPathCaseClashes([]), []);
  assert.deepEqual(findPathCaseClashes(['Foo.ts', 'Foo.ts']), []);
});

test('keeps diagnostics on one line for unusual Git filenames', () => {
  const clashes = findPathCaseClashes(['Foo\nbar.ts', 'foo\nbar.ts']);
  assert.equal(clashes.length, 1);
  assert.ok(!clashes[0].includes('\n'));
});
