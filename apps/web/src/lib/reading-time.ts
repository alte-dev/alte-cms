/**
 * Extracts plain text from Lexical editor JSON structure or plain string
 */
export function extractLexicalText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;

  if (Array.isArray(node)) {
    return node.map(extractLexicalText).join(" ");
  }

  let text = "";
  if (node.text && typeof node.text === "string") {
    text += node.text + " ";
  }

  if (node.children && Array.isArray(node.children)) {
    text += extractLexicalText(node.children);
  }

  if (node.root) {
    text += extractLexicalText(node.root);
  }

  return text;
}

/**
 * Calculates estimated reading time in minutes based on ~200 words per minute.
 * Minimum 1 minute.
 */
export function calculateReadingTime(content: any): number {
  const plainText = extractLexicalText(content).trim();
  if (!plainText) return 1;

  // Split by whitespace
  const words = plainText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount <= 0) return 1;
  return Math.max(1, Math.ceil(wordCount / 200));
}
