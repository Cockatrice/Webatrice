import { findChatAlert, parseHighlightWords, parseMention, segmentText } from './chatHighlight';

const ctx = { selfName: 'Alice', mentions: true, highlightWords: [] as string[], senderIsModerator: false };

describe('parseHighlightWords', () => {
  it('splits on any whitespace and drops empties', () => {
    expect(parseHighlightWords('  edh   modern\tcube ')).toEqual(['edh', 'modern', 'cube']);
    expect(parseHighlightWords('')).toEqual([]);
  });
});

describe('segmentText', () => {
  it('highlights alert words case-insensitively, leaving trailing punctuation plain', () => {
    expect(segmentText('anyone up for EDH? edhrec', { highlightWords: ['edh'], allMention: false })).toEqual([
      { kind: 'plain', text: 'anyone up for ' },
      { kind: 'word', text: 'EDH' },
      { kind: 'plain', text: '? edhrec' },
    ]);
  });

  it('starts words after leading punctuation', () => {
    expect(segmentText('(edh', { highlightWords: ['edh'], allMention: false })).toEqual([
      { kind: 'plain', text: '(' },
      { kind: 'word', text: 'edh' },
    ]);
  });

  it('marks @/all only when allowed', () => {
    expect(segmentText('@/all restart soon', { highlightWords: [], allMention: true })[0]).toEqual({
      kind: 'allMention',
      text: '@/all',
    });
    expect(segmentText('@/all restart soon', { highlightWords: [], allMention: false })).toEqual([
      { kind: 'plain', text: '@/all restart soon' },
    ]);
  });
});

describe('parseMention', () => {
  it('cuts sentence punctuation off another user\'s name', () => {
    expect(parseMention('foo.bar.', 'Alice')).toEqual({ name: 'foo.bar', rest: '.', own: false });
    expect(parseMention('foo-bar', 'Alice')).toEqual({ name: 'foo-bar', rest: '', own: false });
  });

  it('cuts characters back until it names the reader, as desktop\'s checkMention does', () => {
    expect(parseMention('alice-.', 'Alice-')).toEqual({ name: 'alice-', rest: '.', own: true });
    expect(parseMention('alice.', 'Alice')).toEqual({ name: 'alice', rest: '.', own: true });
    expect(parseMention('alice.b', 'Alice')).toEqual({ name: 'alice.b', rest: '', own: false });
  });
});

describe('findChatAlert', () => {
  it('resolves the complete username before treating punctuation as a suffix', () => {
    expect(findChatAlert('@alice_', { ...ctx, userNames: ['Alice', 'alice_'] })).toBeNull();
    expect(findChatAlert('@alice_.', { ...ctx, userNames: ['Alice', 'alice_'] })).toBeNull();
  });

  it('recognizes mentions and alert words inside punctuation', () => {
    expect(findChatAlert('(@alice)', ctx)).toBe('mention');
    expect(findChatAlert('(cube)', { ...ctx, highlightWords: ['cube'] })).toBe('word');
  });
  it('finds a mention of the reader, ignoring case and trailing punctuation', () => {
    expect(findChatAlert('hey @alice, ready?', ctx)).toBe('mention');
    expect(findChatAlert('hey @alicex', ctx)).toBeNull();
    expect(findChatAlert('email@alice.com', ctx)).toBeNull();
  });

  it('finds a mention of a reader whose name has dots, dashes or underscores', () => {
    const dotted = { ...ctx, selfName: 'foo.bar-baz_1' };
    expect(findChatAlert('hi @foo.bar-baz_1', dotted)).toBe('mention');
    expect(findChatAlert('hi @Foo.Bar-Baz_1.', dotted)).toBe('mention');
    expect(findChatAlert('hi @foo.bar', dotted)).toBeNull();
    expect(findChatAlert('hi @foo.bar-baz_1x', dotted)).toBeNull();
  });

  it('does not take a longer dotted name for the reader\'s', () => {
    expect(findChatAlert('hi @alice.smith', ctx)).toBeNull();
  });

  it('ignores mentions when chat mentions are off', () => {
    expect(findChatAlert('hey @Alice', { ...ctx, mentions: false })).toBeNull();
  });

  it('honours @/all from moderators only', () => {
    expect(findChatAlert('@/all server restart', { ...ctx, senderIsModerator: true })).toBe('allMention');
    expect(findChatAlert('@/all server restart', ctx)).toBeNull();
  });

  it('reports alert words, below mentions', () => {
    const words = { ...ctx, highlightWords: ['cube'] };
    expect(findChatAlert('cube draft tonight', words)).toBe('word');
    expect(findChatAlert('@Alice cube draft tonight', words)).toBe('mention');
  });

  it('raises nothing without a reader name or words', () => {
    expect(findChatAlert('@Alice hi', { ...ctx, selfName: null })).toBeNull();
  });
});
