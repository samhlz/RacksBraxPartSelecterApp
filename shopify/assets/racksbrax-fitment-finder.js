(function () {
  var unavailableMessage = "we don't fitt. :(... yet \uD83D\uDC40";
  var priceCache = {};

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
    url.pathname = url.pathname.replace(/\/$/, '') + '.js';

    return url.toString();
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
      return Promise.resolve(undefined);
    }

    if (!priceCache[cacheKey]) {
      priceCache[cacheKey] = fetch(productJsonUrl(product.url))
        .then(function (response) {
          if (!response.ok) return undefined;

          return response.json();
        })
        .then(function (productData) {
          var variants = productData && productData.variants;
          var variant = variants && variants.find(function (item) {
            return String(item.id) === product.variantId;
          });

          variant = variant || (variants && variants[0]);

          return variant && typeof variant.price === 'number'
            ? formatPrice(variant.price)
            : undefined;
        })
        .catch(function () {
          return undefined;
        });
    }

    return priceCache[cacheKey];
  }

  function hydrateProductPrices(result, fitment) {
    Promise.all(fitment.products.map(loadProductPrice)).then(function (prices) {
      prices.forEach(function (price, index) {
        fitment.products[index].price = price || 'Price coming soon';
      });

      var productResults = result.querySelector('.racksbrax-fitment-finder__product-results');

      if (productResults) {
        productResults.innerHTML = renderProductCards(fitment);
      }
    });
  }

  function renderProductCards(fitment) {
    return fitment.products
      .map(function (product) {
        return [
          '<article class="racksbrax-fitment-finder__product-card">',
          '<p class="racksbrax-fitment-finder__product-label">Required product</p>',
          '<h4>' + product.name + '</h4>',
          '<p class="racksbrax-fitment-finder__price">' + (product.price || 'Loading price') + '</p>',
          product.url
            ? '<a class="racksbrax-fitment-finder__product-link" href="' +
              product.url +
              '" target="_blank" rel="noopener">View product</a>'
            : '<p class="racksbrax-fitment-finder__missing-link">Product page coming soon</p>',
          '</article>',
        ].join('');
      })
      .join('');
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

  function firstProductUrl(fitment) {
    var product = fitment.products.find(function (item) {
      return item.url;
    });

    return product ? product.url : '';
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

  function attachActionButtons(result, fitment) {
    var buyNowButton = result.querySelector('[data-buy-now]');
    var addToCartButton = result.querySelector('[data-add-to-cart]');
    var closerLookButton = result.querySelector('[data-closer-look]');
    var productUrl = firstProductUrl(fitment);

    if (closerLookButton) {
      closerLookButton.disabled = !productUrl;
      closerLookButton.addEventListener('click', function () {
        if (productUrl) {
          window.location.href = productUrl;
        }
      });
    }

    if (addToCartButton) {
      addToCartButton.addEventListener('click', function () {
        addToCartButton.disabled = true;
        setActionStatus(result, 'Adding setup to cart...', false);

        addFitmentToCart(fitment)
          .then(function () {
            setActionStatus(result, 'Added to cart.', false);
            window.location.href = '/cart';
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
        setActionStatus(result, 'Preparing checkout...', false);

        addFitmentToCart(fitment)
          .then(function () {
            window.location.href = '/checkout';
          })
          .catch(function (error) {
            setActionStatus(result, error.message, true);
            buyNowButton.disabled = false;
          });
      });
    }
  }

  function renderUnavailableResult(result, fitment) {
    result.innerHTML = [
      '<div class="racksbrax-fitment-finder__result-header">',
      '<h3>',
      unavailableMessage,
      '</h3>',
      '<p>Selected awning: ',
      fitment.brand,
      ' ',
      fitment.model,
      '</p>',
      '</div>',
    ].join('');
  }

  function renderResult(result, fitment) {
    result.innerHTML = [
      '<div class="racksbrax-fitment-finder__result-header">',
      '<h3>Your recommended RacksBrax setup</h3>',
      '<p>Based on your awning selection, these are the parts you need.</p>',
      '</div>',
      '<p class="racksbrax-fitment-finder__selected-awning"><strong>Selected awning:</strong> ',
      fitment.brand,
      ' ',
      fitment.model,
      '</p>',
      '<div class="racksbrax-fitment-finder__product-results">',
      renderProductCards(fitment),
      '</div>',
      '<div class="racksbrax-fitment-finder__actions">',
      '<button class="racksbrax-fitment-finder__primary-action" type="button" data-buy-now>Buy now</button>',
      '<button class="racksbrax-fitment-finder__secondary-action" type="button" data-add-to-cart>Add to cart</button>',
      '<button class="racksbrax-fitment-finder__secondary-action" type="button" data-closer-look>Have a closer look</button>',
      '</div>',
      '<p class="racksbrax-fitment-finder__action-status" data-action-status></p>',
      fitment.pocketGuideUrl
        ? '<a class="racksbrax-fitment-finder__pocket-guide" href="' +
          fitment.pocketGuideUrl +
          '" target="_blank" rel="noopener">View pocket guide</a>'
        : '',
    ].join('');

    hydrateProductPrices(result, fitment);
    attachActionButtons(result, fitment);
  }

  function initFinder(section) {
    if (section.dataset.racksbraxInitialized === 'true') return;

    section.dataset.racksbraxInitialized = 'true';

    var csvUrl = section.dataset.fitmentsUrl;
    var brandSelect = section.querySelector('[data-brand-select]');
    var modelSelect = section.querySelector('[data-model-select]');
    var result = section.querySelector('[data-result]');
    var revealButton = section.querySelector('[data-reveal-finder]');
    var touchStartY = 0;

    function setFinderReveal(isRevealed) {
      section.classList.toggle('is-finder-revealed', isRevealed);
    }

    window.addEventListener(
      'wheel',
      function (event) {
        if (Math.abs(event.deltaY) < 8) return;

        setFinderReveal(event.deltaY > 0);
      },
      { passive: true }
    );

    window.addEventListener(
      'touchstart',
      function (event) {
        touchStartY = event.touches[0] ? event.touches[0].clientY : 0;
      },
      { passive: true }
    );

    window.addEventListener(
      'touchmove',
      function (event) {
        var currentY = event.touches[0] ? event.touches[0].clientY : touchStartY;
        var deltaY = touchStartY - currentY;

        if (Math.abs(deltaY) < 24) return;

        setFinderReveal(deltaY > 0);
      },
      { passive: true }
    );

    if (revealButton) {
      revealButton.addEventListener('click', function () {
        setFinderReveal(true);
      });
    }

    section.addEventListener('click', function (event) {
      if (!event.target.closest('.racksbrax-fitment-finder__intro')) return;
      if (event.target.closest('a')) return;

      setFinderReveal(true);
    });

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
          result.textContent = 'No awnings loaded. Check that fitments_product_columns_with_urls.csv is uploaded to theme assets.';
          return;
        }

        setOptions(brandSelect, 'Select brand', brands);

        brandSelect.addEventListener('change', function () {
          var brand = brandSelect.value;

          modelSelect.disabled = !brand;
          setOptions(modelSelect, 'Select model', []);
          result.textContent = brand
            ? 'Select a model to see what you need.'
            : 'Tell us what awning you have to see your recommended RacksBrax setup.';

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

          setOptions(modelSelect, 'Select model', models);
        });

        modelSelect.addEventListener('change', function () {
          var selectedFitment = fitments.find(function (fitment) {
            return fitment.brand === brandSelect.value && fitment.model === modelSelect.value;
          });

          if (!selectedFitment) {
            result.textContent = unavailableMessage;
            return;
          }

          if (isUnavailableFitment(selectedFitment)) {
            renderUnavailableResult(result, selectedFitment);
            return;
          }

          renderResult(result, selectedFitment);
        });
      })
      .catch(function (error) {
        console.error(error);
        result.textContent = 'Could not load fitment data. Check that fitments_product_columns_with_urls.csv is uploaded to theme assets.';
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
