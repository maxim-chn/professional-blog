const HTML_SPECIAL_CHARACTER_PATTERN = /[&<>"']/g;
const HTML_CHARACTER_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(
    HTML_SPECIAL_CHARACTER_PATTERN,
    (character) => HTML_CHARACTER_ENTITIES[character],
  );
}
