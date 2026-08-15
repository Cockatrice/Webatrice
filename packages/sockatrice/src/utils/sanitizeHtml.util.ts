import createDOMPurify from 'dompurify';
import type DOMPurifyType from 'dompurify';

// DOMPurify's default export is initialized once at module load using
// `globalThis.window`. If the module is imported before a window exists
// (SSR, Node worker startup, some vitest transform paths) the returned
// instance is a stripped stub without `.addHook` / `.sanitize`. Lazily
// create + memoize a real instance the first time we're called, so the
// import order stops mattering. When a factory-shaped default is not
// available, we fall back to whatever the default export was.
let instance: typeof DOMPurifyType | null = null;
function getPurify(): typeof DOMPurifyType {
  if (instance && typeof instance.sanitize === 'function') return instance;
  const win = (globalThis as { window?: Window }).window;
  const asFactory = createDOMPurify as unknown as ((w?: Window) => typeof DOMPurifyType);
  instance = (win && typeof asFactory === 'function')
    ? asFactory(win)
    : (createDOMPurify as unknown as typeof DOMPurifyType);
  if (typeof instance.addHook === 'function') {
    instance.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }
  return instance;
}

export function sanitizeHtml(msg: string): string {
  // See .github/instructions/sockatrice.instructions.md#server-message-sanitization.
  const purify = getPurify();
  if (typeof purify.sanitize !== 'function') return msg;
  return purify.sanitize(msg, {
    ALLOWED_TAGS: ['br', 'a', 'img', 'center', 'b', 'font'],
    ALLOWED_ATTR: ['href', 'color', 'rel', 'target', 'src', 'alt'],
    ADD_URI_SAFE_ATTR: ['color'],
    ALLOWED_URI_REGEXP: /^https?:/i,
  });
}
