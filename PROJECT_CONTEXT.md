# RacksBrax Part Selector / Website Experience Prototype

## Project Goal

RacksBrax is redesigning the website experience because customers are getting confused about which RacksBrax product they need.

The new website experience should be front and centre:

1. Customer identifies what awning or accessory they have.
2. The website tells them what RacksBrax hitch/products they need.
3. The result should be simple, confidence-building, and eventually allow add-to-cart or checkout.

This is currently a rapid prototype, not production code.

## Current Tech Stack

- Vite
- TypeScript
- Plain HTML/CSS/TS
- Git
- GitHub
- GitHub Pages

Local folder:

```text
C:\PartSelecterApp
```

GitHub repo:

```text
samhlz/RacksBraxPartSelecterApp
```

## Current Prototype State

The app currently:

- Loads product-column fitment data from `public/data/fitments_product_columns_with_urls.csv`.
- Filters to awning fitments.
- Has an awning brand dropdown.
- Has an awning model dropdown.
- Shows only `Here's what you need` with one or two product recommendation lines.
- Formats recommendations as `Product name ####`.
- Has a homepage-style prototype experience.
- Uses background colour `#00495D`.
- Uses the main headline: `Quick release system for awnings and accessories.`
- Places the dropdowns beside each other on wider screens.
- Has a top-right `Continue to site` link.

Current known local details:

- Main app file: `src/main.ts`
- Main styles: `src/style.css`
- CSV loader: `src/services/CsvFitmentLoader.ts`
- Fitment types: `src/models/Fitment.ts`
- Current source CSV: `public/data/fitments_product_columns_with_urls.csv`
- `npm.cmd run build` passes on Windows.
- Use `npm.cmd` rather than `npm` in PowerShell if execution policy blocks `npm.ps1`.

## Product / UX Direction

This should feel less like a product catalogue and more like a guided finder.

Primary homepage promise:

```text
Quick release system for awnings and accessories.
```

Customer journey:

```text
What awning brand do you have?
then
What awning model do you have?
then
You need this RacksBrax hitch/product system.
```

The goal is to reduce customer confusion.

## Important Product Logic

Not every awning just needs a hitch.

Some awnings may need:

- Hitch
- Adaptor
- Bracket
- Packer
- Spacer
- Hardware
- Wall mount option

Long-term data should use recommendation lines:

```text
one fitment
to
many recommendation lines
```

Do not design the data as if each awning has only one required hitch.

## Data Direction

Current prototype uses `public/data/fitments_product_columns_with_urls.csv`, derived from Airtable.

Important current CSV columns:

- `Brand-2`
- `Model`
- `Model-2`
- `Manufacturer SKU`
- `RacksBrax Products`
- `Accessories`
- `Product1`
- `Product1 SKU`
- `Product1 URL`
- `Product2`
- `Product2 SKU`
- `Product2 URL`
- `Download Link`
- `Logo`

Long term, data should likely be separated into:

- Fitments
- Recommendation lines
- RacksBrax product master
- Shopify variant mapping

The app should eventually use Shopify variant IDs for add-to-cart.

## Shopify Direction

This should eventually become a Shopify homepage section, not a public Shopify app.

Likely Shopify structure:

```text
sections/
  racksbrax-fitment-finder.liquid

assets/
  racksbrax-fitment-finder.js
  racksbrax-fitment-finder.css
  fitments.json or fitments.csv
```

The Shopify version should use Shopify `cart/add.js` or cart permalinks once real variant IDs exist.

## Coding Style

For now, prioritise rapid prototype speed over production perfection.

- Keep files understandable.
- Avoid over-engineering.
- Make small, safe changes one at a time.
- Make changes that are easy to show to the RacksBrax team.

## How To Brief A New Codex Session

Start a new Codex or ChatGPT coding session with:

```text
Read PROJECT_CONTEXT.md first. Use it as the source of truth for this prototype. Help me make small, safe changes one at a time.
```

This file is the bridge between product direction, previous chats, and local code edits.
