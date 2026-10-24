import { applyMention, findMentionQuery, matchMentions } from './mentionQuery';

describe('findMentionQuery', () => {
  it('finds an @ at the start of the text', () => {
    expect(findMentionQuery('@al', 3)).toEqual({ start: 0, prefix: '@al' });
  });

  it('finds an @ after whitespace', () => {
    expect(findMentionQuery('hi @al', 6)).toEqual({ start: 3, prefix: '@al' });
  });

  it('offers every name for a bare @', () => {
    expect(findMentionQuery('hi @', 4)).toEqual({ start: 3, prefix: '@' });
  });

  it('ignores an @ inside a word, such as an email address', () => {
    expect(findMentionQuery('me@example', 10)).toBeNull();
  });

  it('reads only up to the caret', () => {
    expect(findMentionQuery('@alice and more', 3)).toEqual({ start: 0, prefix: '@al' });
  });

  it('ends at whitespace, so a finished mention is no query', () => {
    expect(findMentionQuery('@alice ', 7)).toBeNull();
  });

  it('has no query without an @', () => {
    expect(findMentionQuery('hello', 5)).toBeNull();
  });
});

describe('matchMentions', () => {
  const names = ['Alice', 'albert', 'Bob', 'alfred'];

  it('matches from the start, ignoring case, in the given order', () => {
    expect(matchMentions(names, '@AL', 10)).toEqual(['Alice', 'albert', 'alfred']);
  });

  it('does not match inside a name', () => {
    expect(matchMentions(names, '@ob', 10)).toEqual([]);
  });

  it('stops at the limit', () => {
    expect(matchMentions(names, '@', 2)).toEqual(['Alice', 'albert']);
  });

  it('lists a name once', () => {
    expect(matchMentions(['Bob', 'Bob'], '@b', 10)).toEqual(['Bob']);
  });
});

describe('applyMention', () => {
  it('replaces the query with the name and a space, caret after it', () => {
    expect(applyMention('hi @al', { start: 3, prefix: '@al' }, 6, 'Alice')).toEqual({ text: 'hi @Alice ', caret: 10 });
  });

  it('keeps the text after the caret', () => {
    expect(applyMention('@al, gg', { start: 0, prefix: '@al' }, 3, 'Alice')).toEqual({ text: '@Alice , gg', caret: 7 });
  });
});
