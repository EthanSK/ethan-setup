// Browser contract for the synced Agentic Mouse HUD. — GPT-6
import type { MouseSimulator } from "./simulator.mjs";

export function createNativeHUD(element: HTMLElement, simulator: MouseSimulator, options: {
  activate: (cell: number) => void;
  preview: (cell: number) => void;
  bindHold: (button: HTMLButtonElement, cell: number) => void;
  keydown: (event: KeyboardEvent) => void;
}): () => void;
