// Content script for bottle-stop.com.au/collections/craft-beer
// Helper: Collect links from current page
function collectLinksFromPage() {
  const productCards = document.querySelectorAll('li.grid__item');
  const links = [];
  productCards.forEach(card => {
    const firstHeading = card.querySelector('h3.card__heading');
    if (firstHeading) {
      const link = firstHeading.querySelector('a');
      if (link && link.href) {
        links.push(link.href);
      }
    }
  });
  return links;
}

// Helper: Find the next page button
function getNextPageButton() {
  return document.querySelector('a[aria-label="Next page"].pagination__item');
}

// --- STATE MANAGEMENT ---

// Crawl State
function setCrawlInProgress(val) { localStorage.setItem('bottleStopCrawlInProgress', val ? 'true' : 'false'); }
function getCrawlInProgress() { return localStorage.getItem('bottleStopCrawlInProgress') === 'true'; }
function setCollectedLinks(links) { localStorage.setItem('bottleStopCollectedLinks', JSON.stringify(links)); }
function getCollectedLinks() {
  try {
    return JSON.parse(localStorage.getItem('bottleStopCollectedLinks')) || [];
  } catch {
    return [];
  }
}
function setVisitedPages(pages) { localStorage.setItem('bottleStopVisitedPages', JSON.stringify(pages)); }
function getVisitedPages() {
    try {
        return JSON.parse(localStorage.getItem('bottleStopVisitedPages')) || [];
    } catch {
        return [];
}
}

// Extracted Data State
function setExtractedData(data) { localStorage.setItem('bottleStopExtractedData', JSON.stringify(data)); }
function getExtractedData() {
    try {
        return JSON.parse(localStorage.getItem('bottleStopExtractedData')) || [];
    } catch {
        return [];
    }
}

// Target Navigation State
function setTargetNavigationInProgress(val) { localStorage.setItem('bottleStopTargetNavInProgress', val ? 'true' : 'false'); }
function getTargetNavigationInProgress() { return localStorage.getItem('bottleStopTargetNavInProgress') === 'true'; }
function setTargetNavigationQueue(urls) { localStorage.setItem('bottleStopTargetNavQueue', JSON.stringify(urls)); }
function getTargetNavigationQueue() {
  try {
    return JSON.parse(localStorage.getItem('bottleStopTargetNavQueue')) || [];
  } catch {
    return [];
  }
}
function setCurrentTargetIndex(index) { localStorage.setItem('bottleStopCurrentTargetIndex', index.toString()); }
function getCurrentTargetIndex() { return parseInt(localStorage.getItem('bottleStopCurrentTargetIndex') || '0'); }


// --- CORE LOGIC ---

// CRAWL LOGIC (Page-by-page link collection)
function continueCrawl() {
  // Ensure we are on a collection page to continue crawling
  if (!window.location.href.includes('/collections/')) {
    console.log('Not a collection page, stopping crawl.');
    setCrawlInProgress(false);
    return;
  }
  
  let allLinks = getCollectedLinks();
  const pageKey = window.location.href;
  let visitedPages = getVisitedPages();

  // Collect links from this page if not already visited
  if (!visitedPages.includes(pageKey)) {
    console.log(`Crawling page: ${pageKey}`);
    const newLinks = collectLinksFromPage();
    allLinks = allLinks.concat(newLinks);
    setCollectedLinks(allLinks);
    
    visitedPages.push(pageKey);
    setVisitedPages(visitedPages);
  } else {
    console.log(`Already visited page: ${pageKey}, skipping collection.`);
}

  // Find and click the next page button
  const nextBtn = getNextPageButton();
  if (nextBtn && nextBtn.getAttribute('aria-disabled') !== 'true') {
    console.log('Found next page button, clicking...');
    setTimeout(() => nextBtn.click(), 500);
  } else {
    console.log('Crawl complete: No next page button found or it is disabled.');
    setCrawlInProgress(false);
    chrome.runtime.sendMessage({ action: "crawl_complete" });
  }
}

// DATA EXTRACTION LOGIC (for product pages)
function extractProductData() {
    console.log("Attempting to extract comprehensive product data...");

    const baseData = {
        productId: 'N/A',
        productUrl: window.location.href,
        imageUrl: 'N/A',
        name: 'N/A',
        brand: 'N/A',
        style: 'N/A',
        abv: 'N/A',
        description: 'N/A',
        rating: 'N/A',
        review: 'N/A',
        bundle: 'N/A',
        stock: 'N/A',
        nonMemberPrice: 'N/A',
        promoPrice: 'N/A',
        discountPrice: 'N/A',
        memberPrice: 'N/A'
    };

    function safeGetText(selector, context = document) {
        try {
            const element = context.querySelector(selector);
            return element ? element.textContent.trim() : 'N/A';
        } catch (e) { console.error(`Error with selector ${selector}:`, e); return 'N/A'; }
    }
    function safeGetAttribute(selector, attribute, context = document) {
        try {
            const element = context.querySelector(selector);
            return element ? element.getAttribute(attribute) || 'N/A' : 'N/A';
        } catch (e) { console.error(`Error getting attribute ${attribute} for selector ${selector}:`, e); return 'N/A'; }
    }

    // --- 1. Attempt to get data from JSON-LD structured data ---
    try {
        const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            const jsonData = JSON.parse(jsonLdScript.textContent);
            baseData.name = jsonData.name || baseData.name;
            baseData.brand = jsonData.brand?.name || baseData.brand;
            baseData.productId = jsonData.sku || baseData.productId;
            baseData.description = jsonData.description || baseData.description;
            baseData.imageUrl = jsonData.image?.[0] || baseData.imageUrl;
            if (baseData.productId === 'N/A') {
                baseData.productId = jsonData['@id'] ? jsonData['@id'].split('#')[0].split('/').pop() : baseData.productId;
            }
            if (jsonData.offers && jsonData.offers.length > 0) {
                const offer = jsonData.offers[0];
                baseData.nonMemberPrice = offer.price ? `$${offer.price}` : baseData.nonMemberPrice;
                const availability = offer.availability?.replace('http://schema.org/', '');
                if (availability === 'InStock') {
                    baseData.stock = 'In Stock';
                } else if (availability === 'OutOfStock') {
                    baseData.stock = 'Out of Stock';
                }
            }
        }
    } catch (e) {
        console.error("Error parsing JSON-LD data:", e);
    }
    
    // --- 2. Use Klaviyo script as a primary fallback ---
    try {
        const scripts = Array.from(document.querySelectorAll('script'));
        const klaviyoScript = scripts.find(s => s.textContent.includes('klaviyo.push') && s.textContent.includes('var item ='));
        if (klaviyoScript) {
            const scriptContent = klaviyoScript.textContent;
            const itemMatch = scriptContent.match(/var item = ({[\s\S]*?});/);
            if (itemMatch && itemMatch[1]) {
                const cleanJsonString = itemMatch[1].replace(/,(\s*[}\]])/g, '$1');
                const itemData = JSON.parse(cleanJsonString);
                if (baseData.productId === 'N/A') baseData.productId = itemData.ProductID || 'N/A';
                if (baseData.productId === 'N/A') baseData.productId = itemData.SKU || 'N/A';
                if (baseData.style === 'N/A') baseData.style = itemData.Categories ? itemData.Categories.join(', ') : 'N/A';
                if (baseData.imageUrl === 'N/A') baseData.imageUrl = itemData.ImageURL || 'N/A';
            }
        }
    } catch (e) {
        console.error('Error parsing Klaviyo script:', e);
    }

    // --- 3. Extract from Product Specifications table ---
    try {
        const specTable = document.querySelector('.product__accordion table');
        if (specTable) {
            const rows = specTable.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 2) {
                    const key = cells[0].textContent.trim().toLowerCase().replace(/\s+/g, '');
                    const value = cells[1].textContent.trim();
                    if (value) {
                        switch (key) {
                            case 'brandname': if (baseData.brand === 'N/A') baseData.brand = value; break;
                            case 'alcoholcontent': if (baseData.abv === 'N/A') baseData.abv = value; break;
                            case 'style': if (baseData.style === 'N/A') baseData.style = value; break;
                        }
                    }
                }
            });
        }
    } catch (e) {
        console.error("Error parsing product specifications table:", e);
    }

    // Extract basic product information
    let productTitle = safeGetText('.product__title h1') || safeGetText('h1.product__title');
    if (baseData.brand !== 'N/A' && productTitle !== 'N/A') {
        // Ensure name includes brand if not already present
        if (!productTitle.toLowerCase().includes(baseData.brand.toLowerCase())) {
            baseData.name = `${baseData.brand} ${productTitle}`;
        } else {
            baseData.name = productTitle;
        }
    } else {
        baseData.name = productTitle;
    }

    // Extract other basic data
    if (baseData.description === 'N/A') baseData.description = safeGetText('.product__description.rte');
    if (baseData.imageUrl === 'N/A') {
        const imgUrl = safeGetAttribute('.product__media img', 'src');
        baseData.imageUrl = imgUrl && imgUrl.startsWith('//') ? 'https:' + imgUrl : imgUrl;
    }

    // Reviews and Rating
    baseData.review = safeGetAttribute('.jdgm-prev-badge', 'data-number-of-reviews');
    baseData.rating = safeGetAttribute('.jdgm-prev-badge', 'data-average-rating');
    
    // Stock status
    const cartButton = document.querySelector('.product-form__submit');
    if (cartButton && cartButton.hasAttribute('disabled')) {
        baseData.stock = 'Out of Stock';
    } else if (cartButton) {
        baseData.stock = 'In Stock';
    }

    // Extract variants and create multiple rows
    const results = [];
    try {
        const variantRadios = document.querySelector('variant-radios');
        if (variantRadios) {
            const variantScript = variantRadios.querySelector('script[type="application/json"]');
            if (variantScript) {
                const variantData = JSON.parse(variantScript.textContent);
                
                variantData.forEach((variant, index) => {
                    const rowData = { ...baseData };
                    rowData.productId = variant.sku || baseData.productId;
                    
                    // Set stock status based on the variant's availability
                    rowData.stock = variant.available ? 'In Stock' : 'Out of Stock';
                    
                    // Determine bundle type from variant title
                    const title = variant.title.toLowerCase();
                    const numberMatch = title.match(/\b(\d+)\b/);

                    if (numberMatch) {
                        const count = parseInt(numberMatch[1], 10);
                        if (title.includes('case')) {
                            rowData.bundle = `Case (${count})`;
                        } else if (title.includes('pack')) {
                            rowData.bundle = `Pack (${count})`;
                        } else {
                            // If no 'case' or 'pack' in title, infer from count.
                            if (count >= 12) {
                                rowData.bundle = `Case (${count})`;
                            } else {
                                rowData.bundle = `Pack (${count})`;
                            }
                        }
                    } else {
                        // Fallback for titles without numbers.
                        if (title.includes('case')) {
                            rowData.bundle = 'Case (24)'; // Default case
                        } else if (title.includes('pack')) {
                            rowData.bundle = 'Pack (6)'; // Default pack
                        } else {
                            rowData.bundle = variant.title;
                        }
                    }
                    
                    // Set prices
                    const price = (variant.price / 100).toFixed(2);
                    rowData.nonMemberPrice = `$${price}`;
                    
                    // If there's a compare_at_price, use it as the regular price
                    if (variant.compare_at_price && variant.compare_at_price > variant.price) {
                        rowData.memberPrice = `$${price}`;
                        rowData.nonMemberPrice = `$${(variant.compare_at_price / 100).toFixed(2)}`;
                    }
                    
                    results.push(rowData);
                });
            } else {
                // Fallback: create single row with basic price info
                const regularPrice = safeGetText('.price-item--regular');
                const salePrice = safeGetText('.price-item--sale');
                
                baseData.nonMemberPrice = regularPrice !== 'N/A' ? regularPrice : salePrice;
                if (salePrice !== 'N/A' && regularPrice !== 'N/A') {
                    baseData.memberPrice = salePrice;
                }
                baseData.bundle = 'Single';
                results.push(baseData);
            }
        } else {
            // No variants found, create single row
            const regularPrice = safeGetText('.price-item--regular');
            const salePrice = safeGetText('.price-item--sale');
            
            baseData.nonMemberPrice = regularPrice !== 'N/A' ? regularPrice : salePrice;
            if (salePrice !== 'N/A' && regularPrice !== 'N/A') {
                baseData.memberPrice = salePrice;
            }
            baseData.bundle = 'Single';
            results.push(baseData);
        }
    } catch (e) {
        console.error("Error parsing variants:", e);
        results.push(baseData);
    }

    console.log("Extracted product data with variants:", results);
    return results;
}

// TARGET NAVIGATION LOGIC (Visit each collected link)
function continueTargetNavigation() {
  const queue = getTargetNavigationQueue();
  let currentIndex = getCurrentTargetIndex();

  console.log(`Continuing target navigation. On page for item ${currentIndex + 1}/${queue.length}.`);

  // --- NEW: Extract data from the current page ---
  // We only extract if we are on a product page, not a collection page.
  if (window.location.href.includes('/products/')) {
    const extractedDataRows = extractProductData();
    const allData = getExtractedData();
    
    // Add all rows from this product (could be multiple for different bundles)
    extractedDataRows.forEach(row => allData.push(row));
    setExtractedData(allData);
    
    const productName = extractedDataRows[0]?.name || 'Unknown Product';
    console.log(`Data for "${productName}" saved (${extractedDataRows.length} rows). Total items: ${allData.length}`);
  }
  // --- END NEW ---


  // Wait some time on the current page before proceeding
  setTimeout(() => {
    // Re-check if process is still active
    if (!getTargetNavigationInProgress()) {
      console.log('Target navigation was stopped during the wait.');
      return;
    }

    currentIndex++; // Move to the next index

    if (currentIndex >= queue.length) {
      console.log('Target navigation complete. All links visited.');
      setTargetNavigationInProgress(false);
      // Don't clear the queue or index, so we know we finished.
    } else {
      console.log(`Navigating to target ${currentIndex + 1}/${queue.length}...`);
      setCurrentTargetIndex(currentIndex);
      const nextUrl = queue[currentIndex];
      if (nextUrl) {
          window.location.href = nextUrl;
      } else {
          console.error(`URL at index ${currentIndex} is invalid. Stopping navigation.`);
          setTargetNavigationInProgress(false);
      }
    }
  }, 3000); // Wait 3 seconds on the page
}


// --- INITIALIZATION & EVENT HANDLERS ---

// A single entry point for handling all page loads
function handlePageLoad() {
    // Determine which process, if any, is active and continue it.
    // The processes are designed to be mutually exclusive.
  if (getTargetNavigationInProgress()) {
        console.log('handlePageLoad: Continuing target navigation.');
        continueTargetNavigation();
    } else if (getCrawlInProgress()) {
        console.log('handlePageLoad: Continuing crawl.');
        continueCrawl();
    }
}

// We wrap the call to handlePageLoad in a timeout to give the page
// time to settle, which is especially important on complex sites or SPAs.
function initialize() {
    setTimeout(handlePageLoad, 1500); // Wait 1.5 seconds before executing.
}

// Attach the handler to run once the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    // DOMContentLoaded has already fired, so just run the initializer
    initialize();
}


// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_crawl_results") {
    const links = getCollectedLinks();
    console.log(`Returning ${links.length} collected links.`);
    sendResponse({ links });

  } else if (request.action === "get_extracted_data") { // --- NEW ACTION ---
    const data = getExtractedData();
    console.log(`Returning ${data.length} extracted data items.`);
    sendResponse({ data: data });
  } else if (request.action === "crawl_all_pages") {
    console.log('Starting a new crawl from the beginning.');
    // Stop any other process
    setTargetNavigationInProgress(false);
    
    // Reset ALL state
    setCollectedLinks([]);
    setVisitedPages([]);
    setExtractedData([]); // --- NEW ---
    setCrawlInProgress(true);
    
    // Start the first step of the crawl
    continueCrawl();
    sendResponse({ started: true });

  } else if (request.action === "start_target_navigation") {
    const allLinks = getCollectedLinks();
    if (allLinks.length === 0) {
      console.log('No links collected to start target navigation.');
      sendResponse({ started: false, message: 'No links to navigate.' });
      return true;
    }
    
    console.log(`Starting target navigation with ${allLinks.length} links.`);
    // Stop any other process
    setCrawlInProgress(false);

    // Set up navigation state, resetting previous data
    setExtractedData([]); // --- NEW ---
    setTargetNavigationQueue(allLinks);
    setCurrentTargetIndex(0);
    setTargetNavigationInProgress(true);
    
    // Navigate to the first URL
    const firstUrl = allLinks[0];
    if (firstUrl) {
        window.location.href = firstUrl;
    }
    sendResponse({ started: true });
  }
  
  // Return true to indicate an async response
  return true;
}); 