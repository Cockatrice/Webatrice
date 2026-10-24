import { downloadBlob } from '@app/utils';

import type { FormPost } from './deckServices';

export function saveTextFile(fileName: string, content: string, mime: string): void {
  downloadBlob(content, fileName, `${mime};charset=utf-8`);
}

export function openInNewTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function submitFormInNewTab({ action, fields }: FormPost): void {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = action;
  form.target = '_blank';
  form.rel = 'noopener noreferrer';
  form.enctype = 'application/x-www-form-urlencoded';
  form.style.display = 'none';
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('textarea');
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    form.remove();
  }
}

export function printHtml(html: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.onload = () => {
    const view = frame.contentWindow;
    if (!view) {
      frame.remove();
      return;
    }
    view.addEventListener('afterprint', () => frame.remove(), { once: true });
    view.focus();
    view.print();
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}
