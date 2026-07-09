import './style.css';
import { loadFitmentsFromCsv } from './services/CsvFitmentLoader';
import type { Fitment } from './models/Fitment';



document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="prototype-page">
    <a class="continue-site-button" href="#">Continue to site</a>

    <section class="hero">
      <div class="hero-intro">
        <p class="eyebrow">RacksBrax Fitment Finder</p>

        <h1>Quick release system for awnings and accessories.</h1>
        <p class="hero-copy">
          Tell us what awning you have and we'll show the RacksBrax hitch system you need.
        </p>
        <button class="start-button" type="button" id="revealFinder">Find my awning</button>
      </div>

      <div class="finder-panel">
        <p class="finder-card-kicker">I have</p>

        <div class="finder-card">
          <div class="finder-grid">
            <div>
              <label for="brand">Brand</label>
              <select id="brand">
                <option value="">Select brand</option>
              </select>
            </div>

            <div>
              <label for="model">Model</label>
              <select id="model" disabled>
                <option value="">Select model</option>
              </select>
            </div>
          </div>
          <section id="result" class="result">
            Select your awning to see the recommended RacksBrax hitch.
          </section>

          <div class="action-buttons">
            <button id="buyNow" class="primary-action" disabled>Buy now</button>
            <button id="addToCart" class="secondary-action" disabled>Add to cart</button>
            <button id="checkItOut" disabled>Have a closer look</button>
          </div>
        </div>
      </div>
    </section>
  </main>
`;

const brandSelect = document.querySelector<HTMLSelectElement>('#brand')!;
const modelSelect = document.querySelector<HTMLSelectElement>('#model')!;
const result = document.querySelector<HTMLElement>('#result')!;
const buyNowButton = document.querySelector<HTMLButtonElement>('#buyNow')!;
const addToCartButton = document.querySelector<HTMLButtonElement>('#addToCart')!;
const checkItOutButton = document.querySelector<HTMLButtonElement>('#checkItOut')!;
const revealFinderButton = document.querySelector<HTMLButtonElement>('#revealFinder')!;
const actionButtonGroup = document.querySelector<HTMLElement>('.action-buttons')!;
const prototypePage = document.querySelector<HTMLElement>('.prototype-page')!;

let csvFitments: Fitment[] = [];
let touchStartY = 0;
let renderVersion = 0;

const actionButtons = [buyNowButton, addToCartButton, checkItOutButton];
const unavailableMessage = "we don't fitt. :(... yet 👀";
const priceCache = new Map<string, Promise<string | undefined>>();

const setActionsVisible = (isVisible: boolean) => {
  actionButtonGroup.classList.toggle('is-visible', isVisible);
  actionButtons.forEach((button) => {
    button.disabled = !isVisible;
  });
};

const renderProductCards = (fitment: Fitment) => {
  return fitment.products
    .map(
      (product) => `
        <article class="product-card">
          <p class="product-label">Required product</p>
          <h4>${product.name}</h4>
          <p class="product-price">${product.price || 'Loading price'}</p>
        </article>
      `
    )
    .join('');
};

const isUnavailableFitment = (fitment: Fitment) => {
  if (!fitment.products.length) return true;

  return fitment.products.some((product) => {
    const productText = `${product.name} ${product.sku || ''}`.toLowerCase();

    return productText.includes('not compatible') || productText.includes('series 33');
  });
};

const renderUnavailableFitment = () => {
  result.innerHTML = `
    <div class="recommendation-header">
      <h3>${unavailableMessage}</h3>
    </div>
  `;
  setActionsVisible(false);
};

const productCacheKey = (product: Fitment['products'][number]) =>
  `${product.url || ''}#${product.variantId || ''}`;

const productJsonUrl = (productUrl: string) => {
  const url = new URL(productUrl);
  url.search = '';
  url.hash = '';
  url.pathname = `${url.pathname.replace(/\/$/, '')}.js`;

  return url.toString();
};

const formatPrice = (priceInCents: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(priceInCents / 100);

const loadProductPrice = (product: Fitment['products'][number]) => {
  const cacheKey = productCacheKey(product);

  if (!product.url) {
    return Promise.resolve(undefined);
  }

  if (!priceCache.has(cacheKey)) {
    priceCache.set(
      cacheKey,
      fetch(productJsonUrl(product.url))
        .then((response) => {
          if (!response.ok) return undefined;

          return response.json();
        })
        .then((productData) => {
          const variants = productData?.variants as Array<{ id: number; price: number }> | undefined;
          const variant = variants?.find((item) => String(item.id) === product.variantId) || variants?.[0];

          return typeof variant?.price === 'number' ? formatPrice(variant.price) : undefined;
        })
        .catch(() => undefined)
    );
  }

  return priceCache.get(cacheKey)!;
};

const hydrateProductPrices = async (fitment: Fitment, version: number) => {
  const prices = await Promise.all(fitment.products.map(loadProductPrice));

  prices.forEach((price, index) => {
    fitment.products[index].price = price || 'Price coming soon';
  });

  if (version === renderVersion) {
    result.querySelector('.product-results')!.innerHTML = renderProductCards(fitment);
  }
};

const setFinderReveal = (isRevealed: boolean) => {
  prototypePage.classList.toggle('finder-revealed', isRevealed);
};

window.addEventListener(
  'wheel',
  (event) => {
    if (Math.abs(event.deltaY) < 8) return;

    setFinderReveal(event.deltaY > 0);
  },
  { passive: true }
);

window.addEventListener(
  'touchstart',
  (event) => {
    touchStartY = event.touches[0]?.clientY ?? 0;
  },
  { passive: true }
);

window.addEventListener(
  'touchmove',
  (event) => {
    const currentY = event.touches[0]?.clientY ?? touchStartY;
    const deltaY = touchStartY - currentY;

    if (Math.abs(deltaY) < 24) return;

    setFinderReveal(deltaY > 0);
  },
  { passive: true }
);

revealFinderButton.addEventListener('click', () => {
  setFinderReveal(true);
});

loadFitmentsFromCsv()
  .then((loadedFitments) => {
    csvFitments = loadedFitments;
    const brands = [...new Set(csvFitments.map((fitment) => fitment.brand))].sort();

    brands.forEach((brand) => {
      brandSelect.add(new Option(brand, brand));
    });

    console.log(`Loaded ${csvFitments.length} fitments`);
  })
  .catch((error) => {
    console.error(error);
    result.textContent = 'Could not load fitment data.';
  });

brandSelect.addEventListener('change', () => {
  const brand = brandSelect.value;

  modelSelect.innerHTML = '<option value="">Select model</option>';
  modelSelect.disabled = !brand;
  result.textContent = 'Select a model to see what you need.';
  setActionsVisible(false);

  if (!brand) return;

  const models = [
    ...new Set(
      csvFitments
        .filter((fitment) => fitment.brand === brand)
        .map((fitment) => fitment.model)
    ),
  ].sort();

  models.forEach((model) => {
    modelSelect.add(new Option(model, model));
  });
});

modelSelect.addEventListener('change', () => {
  const currentRenderVersion = ++renderVersion;
  const brand = brandSelect.value;
  const model = modelSelect.value;

  if (!brand || !model) {
    setActionsVisible(false);
    return;
  }

  const selectedFitment = csvFitments.find(
    (fitment) => fitment.brand === brand && fitment.model === model
  );

  if (!selectedFitment) {
    result.textContent = unavailableMessage;
    setActionsVisible(false);
    return;
  }

  if (isUnavailableFitment(selectedFitment)) {
    renderUnavailableFitment();
    return;
  }

  result.innerHTML = `
    <div class="recommendation-header">
      <h3>Your recommended RacksBrax setup</h3>
      <p>Based on your awning selection, these are the parts you need.</p>
    </div>

    <div class="product-results">
      ${renderProductCards(selectedFitment)}
    </div>
  `;

  setActionsVisible(true);
  void hydrateProductPrices(selectedFitment, currentRenderVersion);
});

buyNowButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Buy now simulation: complete kit added, checkout started.</p>`;
});

addToCartButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Cart simulation: complete kit added, staying on page.</p>`;
});

checkItOutButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Have a closer look simulation: product details opened.</p>`;
});
