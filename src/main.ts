import './style.css';

type RecommendedItem = {
  name: string;
  quantity: number;
  variantId: string;
};

const fitments: Record<string, Record<string, RecommendedItem[]>> = {
  Darche: {
    'Eclipse 270': [
      { name: 'HD Awning Mount', quantity: 2, variantId: 'TBD' },
      { name: 'Spacer Kit', quantity: 1, variantId: 'TBD' },
    ],
    'Hi-View 1800': [
      { name: 'HD Awning Mount', quantity: 2, variantId: 'TBD' },
    ],
  },
  Oztent: {
    'Foxwing 270': [
      { name: 'Standard Awning Bracket Kit', quantity: 1, variantId: 'TBD' },
    ],
  },
};

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="selector">
    <h1>RacksBrax Part Selector</h1>
    <p>Select your awning to find the correct mounting kit.</p>

    <label for="brand">Awning brand</label>
    <select id="brand">
      <option value="">Select brand</option>
    </select>

    <label for="model">Awning model</label>
    <select id="model" disabled>
      <option value="">Select model</option>
    </select>

    <section id="result" class="result">
      Select a brand and model to see what you need.
    </section>

    <button id="addToCart" disabled>Add complete kit</button>
  </main>
`;

const brandSelect = document.querySelector<HTMLSelectElement>('#brand')!;
const modelSelect = document.querySelector<HTMLSelectElement>('#model')!;
const result = document.querySelector<HTMLElement>('#result')!;
const addToCartButton = document.querySelector<HTMLButtonElement>('#addToCart')!;

Object.keys(fitments).forEach((brand) => {
  brandSelect.add(new Option(brand, brand));
});

brandSelect.addEventListener('change', () => {
  const brand = brandSelect.value;

  modelSelect.innerHTML = '<option value="">Select model</option>';
  modelSelect.disabled = !brand;
  result.textContent = 'Select a model to see what you need.';
  addToCartButton.disabled = true;

  if (!brand) return;

  Object.keys(fitments[brand]).forEach((model) => {
    modelSelect.add(new Option(model, model));
  });
});

modelSelect.addEventListener('change', () => {
  const brand = brandSelect.value;
  const model = modelSelect.value;

  if (!brand || !model) return;

  const items = fitments[brand][model];

  result.innerHTML = `
    <h2>Recommended kit</h2>
    <ul>
      ${items.map((item) => `<li>${item.quantity} × ${item.name}</li>`).join('')}
    </ul>
  `;

  addToCartButton.disabled = false;
});

addToCartButton.addEventListener('click', () => {
  result.innerHTML += `<p class="success">Cart simulation: complete kit added.</p>`;
});