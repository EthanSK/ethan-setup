// Boundary for the public Agentic Mouse module synced verbatim into docs/. — GPT-6
export type MouseHand = "corsair" | "razer";

export interface MouseSource {
  id: MouseHand;
  name: string;
}

export interface MouseMap {
  apps: { id: string; title: string }[];
  sources: Record<MouseHand, MouseSource>;
}

interface MouseState {
  selected: number;
  held: number | null;
  mode: string;
  output: string;
  pending: unknown;
  followsApp: boolean;
}

export class MouseSimulator {
  constructor(map: MouseMap);
  app: string;
  hand: MouseHand;
  state: MouseState;
  states: Record<MouseHand, MouseState>;
  control(cell: number): { title: string; wheel?: unknown; keypad?: unknown };
  chooseHand(hand: string): void;
  chooseApp(app: string): void;
  chooseMode(mode: string, followsApp?: boolean): void;
  press(cell: number): void;
  hold(cell: number): void;
  release(): void;
  wheel(direction: "up" | "down"): void;
  reset(): void;
  tick(now?: number): void;
}
