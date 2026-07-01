import type { Fitment } from '../models/Fitment';

type CsvRow = Record<string, string>;

export async function loadFitmentsFromCsv(): Promise<Fitment[]> {
  const response = await fetch('/data/fitments_structured.csv');

  if (!response.ok) {
    throw new Error('Could not load fitments_structured.csv');
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);

  const fitments: Fitment[] = rows.map((row) => {
    return {
      brand: row['brand']?.trim() || '',
      model: row['model']?.trim() || '',
      modelVariant: row['model_variant']?.trim() || '',
      manufacturerSku: row['manufacturer_sku']?.trim() || '',
      products: [
        {
            name: row['product_range']?.trim() || 'RacksBrax product',
            quantity: 1,
            variantId: 'TBD',
        },
    ],
        hitchesNeeded: row['hitches_needed']?.trim() || '',
        accessories: row['accessory_type']?.trim() || '',
        details: row['full_details']?.trim() || '',
        pocketGuideUrl: row['pocket_guide_url']?.trim() || '',
        brandLogoUrl: row['logo_url']?.trim() || '',
    };
  });

  return fitments.filter((fitment) => fitment.brand && fitment.model && fitment.accessories === 'Awnings');
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

