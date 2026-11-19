// Types for the versioned JSON inventories checked by the site build. — GPT-6
export interface ProductPhoto {
  src: string;
  angle: string;
  source: string;
}

export interface GearItem {
  id: string;
  x: number;
  y: number;
  name: string;
  label: string;
  url: string;
  description: string;
  specs: string[];
  images: ProductPhoto[];
  purchase: {
    quantity: number;
    retailer: string | null;
    url: string | null;
    note: string;
  };
}

export interface AppEntry {
  id: string;
  name: string;
  icon: string;
  url?: string;
  note?: string;
}

export interface ProjectEntry {
  name: string;
  repository: string;
  url: string;
  description?: string;
  icon?: string;
}
