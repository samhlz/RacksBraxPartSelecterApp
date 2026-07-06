import type { Fitment } from '../models/Fitment';

type CsvRow = Record<string, string>;

export async function loadFitmentsFromCsv(): Promise<Fitment[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/fitments_product_columns_with_urls.csv`);

  if (!response.ok) {
    throw new Error('Could not load fitments_product_columns_with_urls.csv');
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);

  const fitments: Fitment[] = rows.map((row) => {
    return {
      brand: row['Brand-2']?.trim() || '',
      model: row['Model']?.trim() || '',
      modelVariant: row['Model-2']?.trim() || '',
      manufacturerSku: row['Manufacturer SKU']?.trim() || '',
      productRange: row['RacksBrax Products']?.trim() || '',
      products: buildProducts(row),
      accessories: row['Accessories']?.trim() || '',
      pocketGuideUrl: row['Download Link']?.trim() || '',
      brandLogoUrl: extractLogoUrl(row['Logo']?.trim() || ''),
    };
  });

  return fitments.filter((fitment) => fitment.brand && fitment.model && fitment.accessories === 'Awnings');
}

function buildProducts(row: CsvRow): Fitment['products'] {
  const products: Fitment['products'] = [];

  [1, 2].forEach((productNumber) => {
    const name = row[`Product${productNumber}`]?.trim() || '';

    if (!name) return;

    const url = row[`Product${productNumber} URL`]?.trim() || '';

    products.push({
      name,
      sku: row[`Product${productNumber} SKU`]?.trim() || '',
      url,
      quantity: 1,
      variantId: extractVariantId(url),
    });
  });

  return products;
}

function extractVariantId(url: string) {
  return url.match(/[?&]variant=(\d+)/)?.[1] || '';
}

function extractLogoUrl(logo: string) {
  return logo.match(/\((https?:\/\/[^)]+)\)/)?.[1] || logo;
}

function parseCsv(csvText: string): CsvRow[] {
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

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());

  return dataRows.map((row) => {
    const record: CsvRow = {};

    headers.forEach((header, index) => {
      record[header] = row[index] || '';
    });

    return record;
  });
}

