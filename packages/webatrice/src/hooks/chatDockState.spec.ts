import {
  chatDockReducer, dockCapacity, dockRowWidth, EMPTY_CHAT_DOCK, expandedChatNames, type ChatDockAction, type ChatDockState,
} from './chatDockState';

const run = (...actions: ChatDockAction[]): ChatDockState => actions.reduce(chatDockReducer, EMPTY_CHAT_DOCK);

describe('chatDockReducer', () => {
  it('opens a chat expanded and asks for focus', () => {
    const state = run({ type: 'open', name: 'alice', max: 3 });
    expect(state.chats).toEqual([{ name: 'alice', expanded: true }]);
    expect(state.focus).toEqual({ name: 'alice', seq: 1 });
  });

  it('collapses the oldest expanded window past the limit', () => {
    const state = run(
      { type: 'open', name: 'a', max: 2 },
      { type: 'open', name: 'b', max: 2 },
      { type: 'open', name: 'c', max: 2 },
    );
    expect(state.chats).toEqual([
      { name: 'a', expanded: false },
      { name: 'b', expanded: true },
      { name: 'c', expanded: true },
    ]);
  });

  it('moves a reopened chat to the front and refocuses it', () => {
    const state = run({ type: 'open', name: 'a', max: 3 }, { type: 'open', name: 'b', max: 3 }, { type: 'open', name: 'a', max: 3 });
    expect(state.chats.map((chat) => chat.name)).toEqual(['b', 'a']);
    expect(state.focus).toEqual({ name: 'a', seq: 3 });
  });

  it('adds an incoming chat as a bar and leaves existing chats alone', () => {
    const opened = run({ type: 'open', name: 'a', max: 3 });
    const received = chatDockReducer(opened, { type: 'receive', name: 'a' });
    expect(received).toBe(opened);
    expect(chatDockReducer(opened, { type: 'receive', name: 'b' }).chats).toEqual([
      { name: 'a', expanded: true },
      { name: 'b', expanded: false },
    ]);
  });

  it('minimises, closes and collapses everything', () => {
    const state = run({ type: 'open', name: 'a', max: 3 }, { type: 'open', name: 'b', max: 3 });
    expect(chatDockReducer(state, { type: 'minimise', name: 'a' }).chats[0]).toEqual({ name: 'a', expanded: false });
    const closed = chatDockReducer(state, { type: 'close', name: 'b' });
    expect(closed.chats).toEqual([{ name: 'a', expanded: true }]);
    expect(closed.focus).toBeNull();
    expect(expandedChatNames(chatDockReducer(state, { type: 'collapseAll' }))).toEqual([]);
  });

  it('fits the expanded windows to a smaller limit without touching an already fitting dock', () => {
    const state = run({ type: 'open', name: 'a', max: 3 }, { type: 'open', name: 'b', max: 3 });
    expect(chatDockReducer(state, { type: 'fit', max: 3 })).toBe(state);
    expect(expandedChatNames(chatDockReducer(state, { type: 'fit', max: 1 }))).toEqual(['b']);
  });

  it('measures a row of windows and one chip slot with the gaps between them', () => {
    expect(dockRowWidth(1, false)).toBe(300);
    expect(dockRowWidth(2, true)).toBe(300 + 300 + 160 + 2 * 8);
    expect(dockRowWidth(0, true)).toBe(160);
  });

  it('opens as many windows as the room holds, keeping a chip slot while chats are minimised, and always one', () => {
    expect(dockCapacity(1000, 3)).toBe(3);
    expect(dockCapacity(915, 3)).toBe(2);
    expect(dockCapacity(916, 3)).toBe(3);
    expect(dockCapacity(916, 4)).toBe(2);
    expect(dockCapacity(608, 2)).toBe(2);
    expect(dockCapacity(607, 2)).toBe(1);
    expect(dockCapacity(467, 2)).toBe(1);
    expect(dockCapacity(300, 1)).toBe(1);
    expect(dockCapacity(299, 1)).toBe(1);
  });
});
