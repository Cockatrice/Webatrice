import { keepFocusOnBoardPress } from './keepChatFocus';

const press = (target: Element) => {
  const preventDefault = vi.fn();
  keepFocusOnBoardPress({ target, preventDefault });
  return preventDefault;
};

describe('keepFocusOnBoardPress', () => {
  it('keeps the focus where it is on a press on the board', () => {
    const card = document.createElement('div');
    card.tabIndex = 0;
    expect(press(card)).toHaveBeenCalled();
    expect(press(document.createElement('button'))).toHaveBeenCalled();
  });

  it('lets a press focus a field it is meant to', () => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    label.append(input);
    expect(press(input)).not.toHaveBeenCalled();
    expect(press(document.createElement('textarea'))).not.toHaveBeenCalled();
    expect(press(document.createElement('select'))).not.toHaveBeenCalled();
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const inner = document.createElement('span');
    editable.append(inner);
    expect(press(inner)).not.toHaveBeenCalled();
  });
});
