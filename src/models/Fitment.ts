export type RecommendedProduct = {
  name: string;
  sku?: string;
  url?: string;
  price?: string;
  quantity: number;
  variantId?: string;
};

export type Fitment = {
  brand: string;
  model: string;
  modelVariant?: string;
  manufacturerSku?: string;
  productRange?: string;
  accessories?: string;
  products: RecommendedProduct[];
  hitchesNeeded?: string;
  details?: string;
  note?: string;
  pocketGuideUrl?: string;
  brandLogoUrl?: string;
};
