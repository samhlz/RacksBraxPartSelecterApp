(function () {
  var defaultCopy = {
    unavailableMessage: "we don't fitt. :(... yet \uD83D\uDC40",
    recommendationHeading: 'Your recommended RacksBrax setup',
    recommendationCopy: 'Based on your awning selection, these are the parts you need.',
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
            imageUrl: productData && (productData.featured_image || (productData.images && productData.images[0])),
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
    if (addToCartButton) {
      addToCartButton.addEventListener('click', function () {
        addToCartButton.disabled = true;
        setActionStatus(result, copy.addingToCartMessage, false);

        ensureProductsReady(fitment)
          .then(addFitmentToCart)
          .then(function () {
            setActionStatus(result, copy.addedToCartMessage, false);
            window.location.href = '/checkout';
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
            window.location.href = '/cart';
          })
          .catch(function (error) {
            setActionStatus(result, error.message, true);
            buyNowButton.disabled = false;
          });
      });
    }
  }

  function renderUnavailableResult(result, copy) {
    result.innerHTML = [
      '<div class="racksbrax-fitment-finder__result-header">',
      '<h3>',
      escapeHtml(copy.unavailableMessage),
      '</h3>',
      '</div>',
    ].join('');
  }

  function renderResult(result, fitment, copy) {
    result.innerHTML = [
      '<div class="racksbrax-fitment-finder__result-header">',
      '<h3>' + escapeHtml(copy.recommendationHeading) + '</h3>',
      '<p>' + escapeHtml(copy.recommendationCopy) + '</p>',
      '</div>',
      '<div class="racksbrax-fitment-finder__product-results">',
      renderProductCards(fitment, copy),
      '</div>',
      '<div class="racksbrax-fitment-finder__actions">',
      '<button class="racksbrax-fitment-finder__primary-action" type="button" data-buy-now>' + escapeHtml(copy.buyNowLabel) + '</button>',
      '<button class="racksbrax-fitment-finder__secondary-action" type="button" data-add-to-cart>' + escapeHtml(copy.addToCartLabel) + '</button>',
      '</div>',
      '<p class="racksbrax-fitment-finder__action-status" data-action-status></p>',
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
    var revealButton = section.querySelector('[data-reveal-finder]');
    var copy = getCopy(section);
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
          result.textContent = copy.noAwningsMessage;
          return;
        }

        setOptions(brandSelect, copy.brandPlaceholder, brands);

        brandSelect.addEventListener('change', function () {
          var brand = brandSelect.value;

          modelSelect.disabled = !brand;
          setOptions(modelSelect, copy.modelPlaceholder, []);
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
            result.textContent = copy.unavailableMessage;
            return;
          }

          if (isUnavailableFitment(selectedFitment)) {
            renderUnavailableResult(result, copy);
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
