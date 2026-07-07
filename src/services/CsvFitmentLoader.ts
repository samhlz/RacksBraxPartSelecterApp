import type { Fitment, RecommendedProduct } from '../models/Fitment';

const CSV_PATH = `${import.meta.env.BASE_URL}data/fitments_product_columns_with_urls.csv`;

export async function loadFitments(): Promise<Fitment[]> {
  const response = await fetch(CSV_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load fitments CSV: ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);

  return rows
    .map(rowToFitment)
    .filter((fitment) => fitment.brand && fitment.model && fitment.accessories === 'Awnings');
}

function rowToFitment(row: Record<string, string>): Fitment {
  const product1 = makeProduct(
    row['Product1'],
    row['Product1 SKU'],
    row['Product1 URL']
  );

  const product2 = makeProduct(
    row['Product2'],
    row['Product2 SKU'],
    row['Product2 URL']
  );

  return {
    brand: clean(row['Brand-2']),
    model: clean(row['Model-2'] || row['Model']),
    manufacturerSku: clean(row['Manufacturer SKU']),
    productRange: clean(row['RacksBrax Products']),
    accessories: clean(row['Accessories']),
    products: [product1, product2].filter(Boolean) as RecommendedProduct[],
    pocketGuideUrl: clean(row['Download Link']),
    brandLogoUrl: extractUrl(row['Logo']),
  };
}

function makeProduct(name: string, sku: string, url: string): RecommendedProduct | null {
  const cleanName = clean(name);
  const cleanSku = clean(sku);
  const cleanUrl = clean(url);

  if (!cleanName && !cleanSku) {
    return null;
  }

  return {
    name: cleanName || cleanSku,
    sku: cleanSku,
    url: cleanUrl,
    variantId: extractVariantId(cleanUrl),
    quantity: 1,
  };
}

function clean(value: string | undefined): string {
  return (value || '').trim();
}

function extractVariantId(url: string): string | undefined {
  const match = url.match(/[?&]variant=(\d+)/);
  return match?.[1];
}

function extractUrl(value: string | undefined): string {
  const text = clean(value);
  const match = text.match(/\((https?:\/\/[^)]+)\)/);
  return match?.[1] || text;
}

function parseCsv(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && nextChar === '"') {
      currentCell += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const headers = rows[0].map((header) => header.replace('\uFEFF', '').trim());

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = row[index] || '';
    });

    return record;
  });
}

export const loadFitmentsFromCsv = loadFitments;
