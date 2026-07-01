import type { Fitment } from '../models/Fitment';

type CsvRow = Record<string, string>;

export async function loadFitmentsFromCsv(): Promise<Fitment[]> {
  const response = await fetch('/data/fitments.csv');

  if (!response.ok) {
    throw new Error('Could not load fitments.csv');
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);

  const fitments: Fitment[] = rows.map((row) => {
    return {
      brand: row['Brand-2']?.trim() || '',
      model: row['Model']?.trim() || '',
      modelVariant: row['Model-2']?.trim() || '',
      manufacturerSku: row['Manufacturer SKU']?.trim() || '',
      products: [
        {
          name: row['RacksBrax Products']?.trim() || 'RacksBrax product',
          quantity: 1,
          variantId: 'TBD',
        },
      ],
      accessories: row['Accessories']?.trim() || '',
      details: row['Details']?.trim() || '',
      pocketGuideUrl: row['Download Link']?.trim() || '',
      brandLogoUrl: extractUrl(row['Logo'] || ''),
    };
  });

  return fitments.filter((fitment) => fitment.brand && fitment.model);
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

function extractUrl(value: string): string {
  const match = value.match(/\((https?:\/\/.*?)\)/);
  return match ? match[1] : value.trim();
}