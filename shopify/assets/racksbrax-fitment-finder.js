(function () {
  var defaultCopy = {
    unavailableMessage: "I'm afraid we can't fit to the {model} model.",
    unavailableTemplate: "I'm afraid we can't fit to the {model} model.",
    recommendationHeading: 'Your recommended RacksBrax setup',
    recommendationCopy: 'Based on your awning selection, these are the parts you need.',
    recommendationTemplate: "Here's what you need for your {model}.",
    buyNowLabel: 'Buy now',
    addToCartLabel: 'Add to cart',
    brandPlaceholder: 'Select brand',
    modelPlaceholder: 'Select model',
    initialResult: 'Tell us what awning you have to see your recommended RacksBrax setup.',
    modelPrompt: 'Select a model to see what you need.',
    noAwningsMessage: 'No awnings loaded. Check that fitments_product_columns_with_urls.csv is uploaded to theme assets.',
    loadErrorMessage: 'Could not load fitment data. Check that fitments_product_columns_with_urls.csv is uploaded to theme assets.',
    productLabel: 'Required product',
    loadingPriceLabel: 'Loading price',
    priceComingSoonLabel: 'Price coming soon',
    missingLinkLabel: 'Product page coming soon',
    addingToCartMessage: 'Adding setup to cart...',
    addedToCartMessage: 'Added to cart.',
    missingBrandOption: "I can't find my awning brand",
    emailReminderLabel: "Email me so I don't forget",
    emailReminderMessage: "Enter your email and we'll send this setup to you.",
    emailReminderEmailLabel: 'Enter email',
    emailReminderEmailPlaceholder: 'you@example.com',
    emailReminderSubmitLabel: 'Send reminder',
    emailReminderBackLabel: 'Back',
  };
  var priceCache = {};

  function copyValue(section, key) {
    return section.dataset[key] || defaultCopy[key];
  }

  function getCopy(section) {
    return Object.keys(defaultCopy).reduce(function (copy, key) {
      copy[key] = copyValue(section, key);
      return copy;
    }, {});
  }

  function parseCsv(csvText) {
    var rows = [];
    var currentRow = [];
    var currentCell = '';
    var insideQuotes = false;

    for (var i = 0; i < csvText.length; i += 1) {
      var char = csvText[i];
      var nextChar = csvText[i + 1];

      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i += 1;
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
          i += 1;
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

    var headerRow = rows.shift() || [];
    var headers = headerRow.map(function (header) {
      return header.replace('\uFEFF', '').trim();
    });

    return rows.map(function (row) {
      var record = {};

      headers.forEach(function (header, index) {
        record[header] = row[index] || '';
      });

      return record;
    });
  }

  function extractVariantId(url) {
    var match = url.match(/[?&]variant=(\d+)/);
    return match ? match[1] : '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildProducts(row) {
    var products = [];

    [1, 2].forEach(function (productNumber) {
      var name = (row['Product' + productNumber] || '').trim();
      var sku = (row['Product' + productNumber + ' SKU'] || '').trim();

      if (!name && !sku) return;

      var url = (row['Product' + productNumber + ' URL'] || '').trim();

      products.push({
        name: name || sku,
        sku: sku,
        url: url,
        variantId: extractVariantId(url),
      });
    });

    return products;
  }

  function mapFitment(row) {
    return {
      brand: (row['Brand-2'] || '').trim(),
      model: (row['Model-2'] || row.Model || '').trim(),
      modelVariant: (row['Model-2'] || '').trim(),
      manufacturerSku: (row['Manufacturer SKU'] || '').trim(),
      productRange: (row['RacksBrax Products'] || '').trim(),
      accessories: (row.Accessories || '').trim(),
      products: buildProducts(row),
      pocketGuideUrl: (row['Download Link'] || '').trim(),
      note: (row.Note || '').trim(),
    };
  }

  function setOptions(select, placeholder, values) {
    select.innerHTML = '';
    select.add(new Option(placeholder, ''));

    values.forEach(function (value) {
      select.add(new Option(value, value));
    });
  }

  function isUnavailableFitment(fitment) {
    if (!fitment.products.length) return true;

    return fitment.products.some(function (product) {
      var productText = (product.name + ' ' + (product.sku || '')).toLowerCase();

      return productText.indexOf('not compatible') !== -1 || productText.indexOf('series 33') !== -1;
    });
  }

  function productCacheKey(product) {
    return (product.url || '') + '#' + (product.variantId || '');
  }

  function productJsonUrl(productUrl) {
    var url = new URL(productUrl);
    url.search = '';
    url.hash = '';

    return url.pathname.replace(/\/$/, '') + '.js';
  }

  function imageSrc(image) {
    if (!image) return undefined;

    if (typeof image === 'string') return image;

    return image.src || (image.preview_image && image.preview_image.src);
  }

  function formatPrice(priceInCents) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(priceInCents / 100);
  }

  function loadProductPrice(product) {
    var cacheKey = productCacheKey(product);

    if (!product.url) {
      return Promise.resolve({});
    }

    if (!priceCache[cacheKey]) {
      priceCache[cacheKey] = fetch(productJsonUrl(product.url))
        .then(function (response) {
          if (!response.ok) return {};

          return response.json();
        })
        .then(function (productData) {
          var variants = productData && productData.variants;
          var variant = variants && variants.find(function (item) {
            return String(item.id) === product.variantId;
          });

          variant = variant || (variants && variants[0]);

          return {
            imageUrl: imageSrc(variant && variant.featured_image) || imageSrc(productData && productData.featured_image) || imageSrc(productData && productData.images && productData.images[0]),
            price: variant && typeof variant.price === 'number' ? formatPrice(variant.price) : undefined,
            variantId: variant && variant.id ? String(variant.id) : undefined,
          };
        })
        .catch(function () {
          return {};
        });
    }

    return priceCache[cacheKey];
  }

  function hydrateProductPrices(result, fitment, copy) {
    Promise.all(fitment.products.map(loadProductPrice)).then(function (prices) {
      prices.forEach(function (productDetails, index) {
        fitment.products[index].price = productDetails.price || copy.priceComingSoonLabel;
        fitment.products[index].imageUrl = productDetails.imageUrl || fitment.products[index].imageUrl;
        fitment.products[index].variantId = fitment.products[index].variantId || productDetails.variantId || '';
      });

      var productResults = result.querySelector('.racksbrax-fitment-finder__product-results');

      if (productResults) {
        productResults.innerHTML = renderProductCards(fitment, copy);
      }
    });
  }

  function renderProductCards(fitment, copy) {
    return fitment.products
      .map(function (product) {
        var productName = escapeHtml(product.name);
        var tagName = product.url ? 'a' : 'article';
        var linkAttributes = product.url
          ? ' href="' + escapeHtml(product.url) + '" class="racksbrax-fitment-finder__product-card"'
          : ' class="racksbrax-fitment-finder__product-card"';

        return [
          '<' + tagName + linkAttributes + '>',
          product.imageUrl
            ? '<img class="racksbrax-fitment-finder__product-image" src="' +
              escapeHtml(product.imageUrl) +
              '" alt="' +
              productName +
              '" loading="lazy">'
            : '',
          '<div class="racksbrax-fitment-finder__product-card-copy">',
          '<p class="racksbrax-fitment-finder__product-label">' + escapeHtml(copy.productLabel) + '</p>',
          '<h4>' + productName + '</h4>',
          '<p class="racksbrax-fitment-finder__price">' + escapeHtml(product.price || copy.loadingPriceLabel) + '</p>',
          !product.url ? '<p class="racksbrax-fitment-finder__missing-link">' + escapeHtml(copy.missingLinkLabel) + '</p>' : '',
          '</div>',
          '</' + tagName + '>',
        ].join('');
      })
      .join('');
  }

  function ensureProductsReady(fitment) {
    return Promise.all(fitment.products.map(loadProductPrice)).then(function (productDetailsList) {
      productDetailsList.forEach(function (productDetails, index) {
        fitment.products[index].price = productDetails.price || fitment.products[index].price;
        fitment.products[index].imageUrl = productDetails.imageUrl || fitment.products[index].imageUrl;
        fitment.products[index].variantId = fitment.products[index].variantId || productDetails.variantId || '';
      });

      return fitment;
    });
  }

  function cartItemsForFitment(fitment) {
    return fitment.products
      .filter(function (product) {
        return product.variantId;
      })
      .map(function (product) {
        return {
          id: Number(product.variantId),
          quantity: 1,
        };
      });
  }

  function setActionStatus(result, message, isError) {
    var status = result.querySelector('[data-action-status]');

    if (!status) return;

    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function addFitmentToCart(fitment) {
    var items = cartItemsForFitment(fitment);

    if (!items.length) {
      return Promise.reject(new Error('No Shopify variant IDs available for this setup.'));
    }

    return fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ items: items }),
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Could not add this setup to cart.');
      }

      return response.json();
    });
  }

  function attachActionButtons(result, fitment, copy) {
    var buyNowButton = result.querySelector('[data-buy-now]');
    var addToCartButton = result.querySelector('[data-add-to-cart]');
    var emailReminderButton = result.querySelector('[data-email-reminder]');
    var emailReminderBackButton = result.querySelector('[data-email-reminder-back]');

    if (emailReminderButton) {
      emailReminderButton.addEventListener('click', function () {
        result.classList.add('is-email-reminder-open');
      });
    }

    if (emailReminderBackButton) {
      emailReminderBackButton.addEventListener('click', function () {
        result.classList.remove('is-email-reminder-open');
      });
    }

    if (addToCartButton) {
      addToCartButton.addEventListener('click', function () {
        addToCartButton.disabled = true;
        setActionStatus(result, copy.addingToCartMessage, false);

        ensureProductsReady(fitment)
          .then(addFitmentToCart)
          .then(function () {
            setActionStatus(result, copy.addedToCartMessage, false);
            addToCartButton.disabled = false;
          })
          .catch(function (error) {
            setActionStatus(result, error.message, true);
            addToCartButton.disabled = false;
          });
      });
    }

    if (buyNowButton) {
      buyNowButton.addEventListener('click', function () {
        buyNowButton.disabled = true;
        setActionStatus(result, copy.addingToCartMessage, false);

        ensureProductsReady(fitment)
          .then(addFitmentToCart)
          .then(function () {
            setActionStatus(result, copy.addedToCartMessage, false);
            window.location.href = '/checkout';
          })
          .catch(function (error) {
            setActionStatus(result, error.message, true);
            buyNowButton.disabled = false;
          });
      });
    }
  }

  function renderFitmentNote(fitment) {
    if (!fitment.note) return '';

    return [
      '<div class="racksbrax-fitment-finder__note">',
      '<strong>Fitment note:</strong> ',
      escapeHtml(fitment.note),
      '</div>',
    ].join('');
  }

  function fitmentReminderBody(fitment) {
    return [
      'Fitment reminder request',
      'Brand: ' + fitment.brand,
      'Model: ' + fitment.model,
      'Products: ' + fitment.products.map(function (product) {
        return product.name + (product.sku ? ' (' + product.sku + ')' : '');
      }).join(', '),
      fitment.note ? 'Fitment note: ' + fitment.note : '',
    ].filter(Boolean).join('\n');
  }

  function titleCase(value) {
    return String(value || '').toLowerCase().replace(/\S+/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
  }

  function formattedModelName(fitment) {
    var model = fitment.model || '';
    var brand = fitment.brand || '';

    if (!brand || model.toLowerCase().indexOf(brand.toLowerCase()) !== 0) {
      return titleCase(model);
    }

    return model.slice(0, brand.length).toUpperCase() + titleCase(model.slice(brand.length));
  }

  function recommendationHeading(fitment, copy) {
    var heading = copy.recommendationTemplate
      .replace('{brand}', fitment.brand.toUpperCase())
      .replace('{model}', formattedModelName(fitment));

    return heading.charAt(0).toUpperCase() + heading.slice(1);
  }

  function unavailableHeading(fitment, copy) {
    var heading = copy.unavailableTemplate
      .replace('{brand}', fitment.brand.toUpperCase())
      .replace('{model}', formattedModelName(fitment));

    return heading.charAt(0).toUpperCase() + heading.slice(1);
  }

  function renderUnavailableResult(result, fitment, copy) {
    result.classList.remove('is-email-reminder-open');
    result.innerHTML = [
      '<div class="racksbrax-fitment-finder__result-header">',
      '<h3>',
      escapeHtml(unavailableHeading(fitment, copy)),
      '</h3>',
      '</div>',
    ].join('');
  }

  function renderEmailReminderForm(fitment, copy) {
    return [
      '<div class="racksbrax-fitment-finder__slide-panel racksbrax-fitment-finder__email-reminder">',
      '<button class="racksbrax-fitment-finder__back-action" type="button" data-email-reminder-back aria-label="' + escapeHtml(copy.emailReminderBackLabel) + '">',
      '<span aria-hidden="true">←</span>',
      '</button>',
      '<form method="post" action="/contact#contact_form" accept-charset="UTF-8">',
      '<input type="hidden" name="form_type" value="contact">',
      '<input type="hidden" name="contact[subject]" value="Fitment reminder">',
      '<textarea name="contact[body]" hidden>' + escapeHtml(fitmentReminderBody(fitment)) + '</textarea>',
      '<p>' + escapeHtml(copy.emailReminderMessage) + '</p>',
      '<label for="RacksBraxEmailReminder">' + escapeHtml(copy.emailReminderEmailLabel) + '</label>',
      '<input id="RacksBraxEmailReminder" type="email" name="contact[email]" autocomplete="email" required placeholder="' + escapeHtml(copy.emailReminderEmailPlaceholder) + '">',
      '<button type="submit">' + escapeHtml(copy.emailReminderSubmitLabel) + '</button>',
      '</form>',
      '</div>',
    ].join('');
  }

  function renderResult(result, fitment, copy) {
    result.classList.remove('is-email-reminder-open');
    result.innerHTML = [
      '<div class="racksbrax-fitment-finder__slide">',
      '<div class="racksbrax-fitment-finder__slide-track">',
      '<div class="racksbrax-fitment-finder__slide-panel">',
      '<div class="racksbrax-fitment-finder__result-header">',
      '<h3>' + escapeHtml(recommendationHeading(fitment, copy)) + '</h3>',
      '</div>',
      renderFitmentNote(fitment),
      '<div class="racksbrax-fitment-finder__product-results">',
      renderProductCards(fitment, copy),
      '</div>',
      '<div class="racksbrax-fitment-finder__actions">',
      '<button class="racksbrax-fitment-finder__primary-action" type="button" data-buy-now>' + escapeHtml(copy.buyNowLabel) + '</button>',
      '<button class="racksbrax-fitment-finder__secondary-action" type="button" data-add-to-cart>' + escapeHtml(copy.addToCartLabel) + '</button>',
      '<button class="racksbrax-fitment-finder__email-action" type="button" data-email-reminder>' + escapeHtml(copy.emailReminderLabel) + '</button>',
      '</div>',
      '<p class="racksbrax-fitment-finder__action-status" data-action-status></p>',
      '</div>',
      renderEmailReminderForm(fitment, copy),
      '</div>',
      '</div>',
    ].join('');

    hydrateProductPrices(result, fitment, copy);
    attachActionButtons(result, fitment, copy);
  }

  function initFinder(section) {
    if (section.dataset.racksbraxInitialized === 'true') return;

    section.dataset.racksbraxInitialized = 'true';

    var csvUrl = section.dataset.fitmentsUrl;
    var brandSelect = section.querySelector('[data-brand-select]');
    var modelSelect = section.querySelector('[data-model-select]');
    var result = section.querySelector('[data-result]');
    var missingBrandForm = section.querySelector('[data-missing-brand-form]');
    var copy = getCopy(section);
    var missingBrandValue = '__missing_brand__';

    function setMissingBrandFormVisible(isVisible) {
      if (!missingBrandForm) return;

      missingBrandForm.hidden = !isVisible;
    }

    if (!csvUrl || !brandSelect || !modelSelect || !result) return;

    fetch(csvUrl)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Could not load fitments CSV');
        }

        return response.text();
      })
      .then(function (csvText) {
        var fitments = parseCsv(csvText)
          .map(mapFitment)
          .filter(function (fitment) {
            return fitment.brand && fitment.model && fitment.accessories === 'Awnings';
          });

        var brands = Array.from(
          new Set(
            fitments.map(function (fitment) {
              return fitment.brand;
            })
          )
        ).sort();

        if (!brands.length) {
          result.textContent = copy.noAwningsMessage;
          return;
        }

        setOptions(brandSelect, copy.brandPlaceholder, brands);
        brandSelect.add(new Option(copy.missingBrandOption, missingBrandValue), brandSelect.options[1] || null);

        brandSelect.addEventListener('change', function () {
          var brand = brandSelect.value;

          result.classList.remove('is-email-reminder-open');
          modelSelect.disabled = !brand;
          setOptions(modelSelect, copy.modelPlaceholder, []);

          if (brand === missingBrandValue) {
            modelSelect.disabled = true;
            result.textContent = '';
            setMissingBrandFormVisible(true);
            return;
          }

          setMissingBrandFormVisible(false);
          result.textContent = brand
            ? copy.modelPrompt
            : copy.initialResult;

          if (!brand) return;

          var models = Array.from(
            new Set(
              fitments
                .filter(function (fitment) {
                  return fitment.brand === brand;
                })
                .map(function (fitment) {
                  return fitment.model;
                })
            )
          ).sort();

          setOptions(modelSelect, copy.modelPlaceholder, models);
        });

        modelSelect.addEventListener('change', function () {
          var selectedFitment = fitments.find(function (fitment) {
            return fitment.brand === brandSelect.value && fitment.model === modelSelect.value;
          });

          if (!selectedFitment) {
            setMissingBrandFormVisible(false);
            result.textContent = unavailableHeading(
              {
                brand: brandSelect.value,
                model: modelSelect.value,
              },
              copy
            );
            return;
          }

          if (isUnavailableFitment(selectedFitment)) {
            renderUnavailableResult(result, selectedFitment, copy);
            return;
          }

          renderResult(result, selectedFitment, copy);
        });
      })
      .catch(function (error) {
        console.error(error);
        result.textContent = copy.loadErrorMessage;
      });
  }

  function initAllFinders() {
    document.querySelectorAll('[data-racksbrax-fitment-finder]').forEach(initFinder);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllFinders);
  } else {
    initAllFinders();
  }
})();
