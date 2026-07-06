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
      </div>

      <div class="finder-card">
        <div class="finder-grid">
          <div>
            <label for="brand">Awning brand</label>
            <select id="brand">
              <option value="">Select awning brand</option>
            </select>
          </div>

          <div>
            <label for="model">Awning model</label>
            <select id="model" disabled>
              <option value="">Select awning model</option>
            </select>
          </div>
        </div>
        <section id="result" class="result">
          Select your awning to see the recommended RacksBrax hitch.
        </section>

        <div class="action-buttons">
          <button id="buyNow" class="primary-action" disabled>Buy now</button>
          <button id="addToCart" disabled>Add to cart</button>
          <button id="checkItOut" disabled>Check it out</button>
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
const prototypePage = document.querySelector<HTMLElement>('.prototype-page')!;

let csvFitments: Fitment[] = [];
let touchStartY = 0;

const actionButtons = [buyNowButton, addToCartButton, checkItOutButton];

const renderProductCards = (fitment: Fitment) => {
  const products = fitment.products.length
    ? fitment.products
    : [{ name: 'RacksBrax hitch system', quantity: 1 }];

  return products
    .map(
      (product) => `
        <article class="product-card">
          <p class="product-label">Required product</p>
          <h4>${product.name}</h4>
          ${product.sku ? `<p class="product-sku">SKU ${product.sku}</p>` : ''}
        </article>
      `
    )
    .join('');
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
  actionButtons.forEach((button) => {
    button.disabled = true;
  });

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
  const brand = brandSelect.value;
  const model = modelSelect.value;

  if (!brand || !model) return;

  const selectedFitment = csvFitments.find(
    (fitment) => fitment.brand === brand && fitment.model === model
  );

  if (!selectedFitment) {
    result.textContent = 'No fitment found for this awning.';
    actionButtons.forEach((button) => {
      button.disabled = true;
    });
    return;
  }

  result.innerHTML = `
    <div class="recommendation-header">
      <h3>Your recommended RacksBrax setup</h3>
      <p>Based on your awning selection, these are the parts you need.</p>
    </div>

    <p class="selected-awning"><strong>Selected awning:</strong> ${selectedFitment.brand} ${selectedFitment.model}</p>

    <div class="product-results">
      ${renderProductCards(selectedFitment)}
    </div>
  `;

  actionButtons.forEach((button) => {
    button.disabled = false;
  });
});

buyNowButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Buy now simulation: checkout started.</p>`;
});

addToCartButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Cart simulation: complete kit added.</p>`;
});

checkItOutButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Check it out simulation: product details opened.</p>`;
});
