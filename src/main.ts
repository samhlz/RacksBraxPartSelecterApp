import './style.css';
import { loadFitmentsFromCsv } from './services/CsvFitmentLoader';
import type { Fitment } from './models/Fitment';



document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="prototype-page">
    <a class="continue-site-button" href="#">Continue to site</a>

    <section class="hero">
      <p class="eyebrow">RacksBrax Fitment Finder</p>

      <h1>Quick release system for awnings and accessories.</h1>
      <p class="hero-copy">
        Tell us what awning you have and we'll show the RacksBrax hitch system you need.
      </p>

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

        <button id="addToCart" disabled>View recommended kit</button>
      </div>
    </section>

    <section class="supporting-copy">
      <h2>Stop guessing. Start with your awning.</h2>
      <p>
        RacksBrax products work as a system. The right hitch depends on the awning you own,
        and some awnings may require adaptors or specific mounting hardware.
      </p>
    </section>
  </main>
`;

const brandSelect = document.querySelector<HTMLSelectElement>('#brand')!;
const modelSelect = document.querySelector<HTMLSelectElement>('#model')!;
const result = document.querySelector<HTMLElement>('#result')!;
const addToCartButton = document.querySelector<HTMLButtonElement>('#addToCart')!;

let csvFitments: Fitment[] = [];

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
  addToCartButton.disabled = true;

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
    addToCartButton.disabled = true;
    return;
  }

  result.innerHTML = `
  <h2>Recommended kit</h2>

  <p><strong>Awning:</strong> ${selectedFitment.brand} ${selectedFitment.model}</p>

  <p><strong>Product range:</strong> ${selectedFitment.products[0]?.name || 'RacksBrax product'}</p>

  ${
  selectedFitment.hitchesNeeded
    ? `<p><strong>Here's what you need:</strong><br>${selectedFitment.hitchesNeeded.replaceAll('\n', '<br>')}</p>`
    : ''
}

  ${
    selectedFitment.pocketGuideUrl
      ? `<p><a href="${selectedFitment.pocketGuideUrl}" target="_blank">Download pocket guide</a></p>`
      : ''
  }

  ${
    selectedFitment.details
      ? `
        <details class="fitment-details">
          <summary>Show detailed fitment notes</summary>
          <div>${selectedFitment.details.replaceAll('\n', '<br>')}</div>
        </details>
      `
      : ''
  }
`;

  addToCartButton.disabled = false;
});

addToCartButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Cart simulation: complete kit added.</p>`;
});
