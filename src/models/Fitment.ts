export type RecommendedProduct = {
  name: string;
  quantity: number;
  variantId: string;
};

export type Fitment = {
  brand: string;
  model: string;
  modelVariant?: string;
  manufacturerSku?: string;
  products: RecommendedProduct[];
  hitchesNeeded?: string;
  accessories?: string;
  details?: string;
  pocketGuideUrl?: string;
  brandLogoUrl?: string;
};