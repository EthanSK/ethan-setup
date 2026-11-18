// Shared queries for the site's fixed HTML and generated controls. — GPT-6
export function requiredElement<K extends keyof HTMLElementTagNameMap>(selector: K, root?: ParentNode): HTMLElementTagNameMap[K];
export function requiredElement<T extends HTMLElement = HTMLElement>(selector: string, root?: ParentNode): T;
export function requiredElement<T extends HTMLElement>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}
