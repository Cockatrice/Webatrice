import { act, renderHook } from '@testing-library/react';

import { type DockedChat } from '../../hooks/chatDockState';
import { dispatchChatDock, getChatDockState } from '../../hooks/useChatDock';
import { useDockFocus } from './useDockFocus';

const chat = (name: string, expanded: boolean): DockedChat => ({ name, expanded });
type Props = { windows: DockedChat[]; bars: DockedChat[]; focus: { name: string; seq: number } | null };

function element<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

describe('useDockFocus', () => {
  afterEach(() => {
    act(() => dispatchChatDock({ type: 'reset' }));
    document.body.innerHTML = '';
  });

  it('remembers what opened the dock and returns focus there when the last chat closes', () => {
    const opener = element('button');
    opener.focus();
    const { result, rerender } = renderHook((props: Props) => useDockFocus(props.windows, props.bars, props.focus), {
      initialProps: { windows: [], bars: [], focus: null },
    });
    rerender({ windows: [chat('alice', true)], bars: [], focus: { name: 'alice', seq: 1 } });
    const input = element('input');
    act(() => result.current.registerInput('alice', input));
    input.focus();

    act(() => result.current.close('alice'));
    rerender({ windows: [], bars: [], focus: null });

    expect(opener).toHaveFocus();
    expect(getChatDockState().chats).toEqual([]);
  });

  it('moves focus to the bar a window was minimised into', () => {
    const { result, rerender } = renderHook((props: Props) => useDockFocus(props.windows, props.bars, props.focus), {
      initialProps: { windows: [chat('alice', true)], bars: [], focus: null },
    });
    const bar = element('button');
    act(() => result.current.registerBar('alice', bar));

    act(() => result.current.minimise('alice'));
    rerender({ windows: [], bars: [chat('alice', false)], focus: null });

    expect(bar).toHaveFocus();
  });

  it('moves focus to a neighbouring window when one of several closes', () => {
    const windows = [chat('alice', true), chat('bob', true)];
    const { result, rerender } = renderHook((props: Props) => useDockFocus(props.windows, props.bars, props.focus), {
      initialProps: { windows, bars: [], focus: null },
    });
    const aliceInput = element('input');
    act(() => result.current.registerInput('alice', aliceInput));

    act(() => result.current.close('bob'));
    rerender({ windows: [chat('alice', true)], bars: [], focus: null });

    expect(aliceInput).toHaveFocus();
  });
});
