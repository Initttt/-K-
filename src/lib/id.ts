// getRandomValues also works on a phone opening a trusted local HTTP preview.
export function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `gear-${Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("")}`;
}
