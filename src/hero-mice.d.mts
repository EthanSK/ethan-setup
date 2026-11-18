// Browser contract for the synced Agentic Mouse model. — GPT-6
import type { MouseHand, MouseSource } from "./simulator.mjs";

export function createHeroMouse(
  figure: HTMLElement,
  source: MouseSource,
  onCell: (hand: MouseHand, cell: number) => void,
  labelForCell: (hand: MouseHand, cell: number) => string,
  wheelZoom?: boolean,
): Promise<boolean>;
