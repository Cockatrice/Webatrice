import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, file), 'utf8');

const css = [
  read('board-motion.css'),
  read('../features/game/Game.css'),
  '.seat-card { transition: transform 150ms ease-out; }',
].join('\n');

function mountBoard(): Record<string, HTMLElement> {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const elements: Record<string, HTMLElement> = {};
  for (const className of [
    'seat-card', 'phase-endstep-flash',
  ]) {
    elements[className] = document.createElement('div');
    elements[className].className = className;
    document.body.appendChild(elements[className]);
  }
  return elements;
}

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete document.documentElement.dataset.animations;
});

describe('board-motion.css', () => {
  it('stops the card hover transition and the phase flash when the policy is off', () => {
    const elements = mountBoard();
    document.documentElement.dataset.animations = 'off';
    expect(getComputedStyle(elements['seat-card']).transition).toBe('none');
    expect(getComputedStyle(elements['phase-endstep-flash']).animation).toBe('none');
  });

  it('leaves them alone when the policy is on, whatever the system setting', () => {
    const elements = mountBoard();
    document.documentElement.dataset.animations = 'on';
    expect(getComputedStyle(elements['seat-card']).transition).not.toBe('none');
    expect(getComputedStyle(elements['phase-endstep-flash']).animation).toContain('phase-endstep-flash');
  });
});
