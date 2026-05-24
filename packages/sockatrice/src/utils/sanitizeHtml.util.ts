import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitizeHtml(msg: string): string {
  // See .github/instructions/sockatrice.instructions.md#server-message-sanitization.
  return DOMPurify.sanitize(msg, {
    ALLOWED_TAGS: ['br', 'a', 'img', 'center', 'b', 'font'],
    ALLOWED_ATTR: ['href', 'color', 'rel', 'target', 'src', 'alt'],
    ADD_URI_SAFE_ATTR: ['color'],
    ALLOWED_URI_REGEXP: /^https?:/i,
  });
}
