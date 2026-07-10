import './style.css';
import { loadFitmentsFromCsv } from './services/CsvFitmentLoader';
import type { Fitment } from './models/Fitment';



document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="prototype-page">
    <a class="continue-site-button" href="#">Continue to site</a>

    <section class="hero">
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

          <section id="missingBrandShell" class="missing-brand-form missing-brand-slide-shell" hidden>
            <div class="missing-brand-slider-track">
              <form id="missingBrandForm" class="missing-brand-panel">
                <p>Enter your email, brand and awning name and we'll get back to you.</p>

                <label for="missingBrandName">Name</label>
                <input id="missingBrandName" type="text" placeholder="Your name" required />

                <label for="missingBrandEmail">Enter email</label>
                <input id="missingBrandEmail" type="email" placeholder="you@example.com" required />

                <label for="missingBrandDetails">Enter brand and awning name</label>
                <textarea id="missingBrandDetails" rows="4" placeholder="Enter brand and awning name" required></textarea>

                <button type="submit">Submit</button>
              </form>

              <div class="missing-brand-panel acknowledgement-card" aria-live="polite">
                <p class="acknowledgement-kicker">Thanks</p>
                <h3>We've got it.</h3>
                <p>We'll get back to you.</p>
              </div>
            </div>
          </section>

          <section class="result result-slide-shell">
            <div class="action-slider-track">
              <div class="action-slider-panel">
                <div id="result">
                  Select your awning to see the recommended RacksBrax hitch.
                </div>

                <div class="action-buttons">
                  <button id="buyNow" class="primary-action" disabled>Buy now</button>
                  <button id="addToCart" class="secondary-action" disabled>Add to cart</button>
                  <button id="emailReminder" class="email-action" disabled>Email me so I don't forget</button>
                </div>
              </div>

              <form id="emailReminderForm" class="action-slider-panel email-reminder-form">
                <button id="emailReminderBack" class="back-action" type="button" aria-label="Back">←</button>
                <p>Enter your email and we'll send this setup to you.</p>

                <label for="emailReminderEmail">Enter email</label>
                <input id="emailReminderEmail" type="email" placeholder="you@example.com" required />

                <button type="submit">Send reminder</button>
              </form>

              <div class="action-slider-panel acknowledgement-card" aria-live="polite">
                <p class="acknowledgement-kicker">Thanks</p>
                <h3>We've got it.</h3>
                <p>We'll email this setup to you.</p>
              </div>
            </div>
          </section>
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
const emailReminderButton = document.querySelector<HTMLButtonElement>('#emailReminder')!;
const actionSlider = document.querySelector<HTMLElement>('.result-slide-shell')!;
const missingBrandShell = document.querySelector<HTMLElement>('#missingBrandShell')!;
const missingBrandForm = document.querySelector<HTMLFormElement>('#missingBrandForm')!;
const emailReminderForm = document.querySelector<HTMLFormElement>('#emailReminderForm')!;
const emailReminderBackButton = document.querySelector<HTMLButtonElement>('#emailReminderBack')!;

let csvFitments: Fitment[] = [];
let renderVersion = 0;

const missingBrandValue = '__missing_brand__';
const actionButtons = [buyNowButton, addToCartButton, emailReminderButton];
const showFitmentNotes = true;
const priceCache = new Map<string, Promise<string | undefined>>();

function titleCase(value: string) {
  return value.toLowerCase().replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function formatModelName(brand: string, model: string) {
  if (!brand || !model.toLowerCase().startsWith(brand.toLowerCase())) {
    return titleCase(model);
  }

  return `${model.slice(0, brand.length).toUpperCase()}${titleCase(model.slice(brand.length))}`;
}

function formattedModelName(fitment: Fitment) {
  return formatModelName(fitment.brand, fitment.model);
}

function unavailableHeading(brand: string, model: string) {
  return `I'm afraid we can't fit to the ${formatModelName(brand, model)} model.`;
}

const setActionsVisible = (isVisible: boolean) => {
  actionSlider.classList.toggle('has-actions', isVisible);
  actionSlider.classList.remove('is-email-reminder-open');
  actionSlider.classList.remove('is-acknowledgement-open');
  actionButtons.forEach((button) => {
    button.disabled = !isVisible;
  });
};

const setMissingBrandFormVisible = (isVisible: boolean) => {
  missingBrandShell.hidden = !isVisible;
  actionSlider.hidden = isVisible;
  if (!isVisible) {
    missingBrandShell.classList.remove('is-acknowledgement-open');
  }
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

const renderUnavailableFitment = (fitment: Fitment) => {
  result.innerHTML = `
    <div class="recommendation-header">
      <h3>${unavailableHeading(fitment.brand, fitment.model)}</h3>
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

loadFitmentsFromCsv()
  .then((loadedFitments) => {
    csvFitments = loadedFitments;
    const brands = [...new Set(csvFitments.map((fitment) => fitment.brand))].sort();

    brands.forEach((brand) => {
      brandSelect.add(new Option(brand, brand));
    });

    brandSelect.add(new Option("I can't find my awning brand", missingBrandValue), brandSelect.options[1] ?? null);

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

  if (brand === missingBrandValue) {
    modelSelect.disabled = true;
    result.textContent = '';
    setMissingBrandFormVisible(true);
    return;
  }

  setMissingBrandFormVisible(false);

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
    result.textContent = unavailableHeading(brand, model);
    setActionsVisible(false);
    return;
  }

  if (isUnavailableFitment(selectedFitment)) {
    renderUnavailableFitment(selectedFitment);
    return;
  }

  result.innerHTML = `
    <div class="recommendation-header">
      <h3>Here's the quick release setup you need for your ${formattedModelName(selectedFitment)}.</h3>
    </div>

    ${
      showFitmentNotes && selectedFitment.note
        ? `<div class="fitment-note"><strong>Note:</strong> ${selectedFitment.note}</div>`
        : ''
    }

    <div class="product-results">
      ${renderProductCards(selectedFitment)}
    </div>
  `;

  actionSlider.classList.remove('is-email-reminder-open');
  actionSlider.classList.remove('is-acknowledgement-open');
  setActionsVisible(true);
  void hydrateProductPrices(selectedFitment, currentRenderVersion);
});

buyNowButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Buy now simulation: complete kit added, checkout started.</p>`;
});

addToCartButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Cart simulation: complete kit added, staying on page.</p>`;
});

emailReminderButton.addEventListener('click', () => {
  actionSlider.classList.add('is-email-reminder-open');
});

emailReminderBackButton.addEventListener('click', () => {
  actionSlider.classList.remove('is-email-reminder-open');
});

emailReminderForm.addEventListener('submit', (event) => {
  event.preventDefault();
  emailReminderForm.reset();
  actionSlider.classList.remove('is-email-reminder-open');
  actionSlider.classList.add('is-acknowledgement-open');
});

missingBrandForm.addEventListener('submit', (event) => {
  event.preventDefault();
  missingBrandForm.reset();
  missingBrandShell.classList.add('is-acknowledgement-open');
});

