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
  }
}

// DATA EXTRACTION LOGIC (for product pages)
function extractProductData() {
    console.log("Attempting to extract comprehensive product data...");

    const data = {
        pageUrl: window.location.href,
        productTitle: 'N/A',
        brand: 'N/A',
        sku: 'N/A',
        availability: 'N/A',
        regularPrice: 'N/A',
        salePrice: 'N/A',
        currency: 'N/A',
        size: 'N/A',
        alcoholContent: 'N/A',
        productType: 'N/A',
        style: 'N/A',
        country: 'N/A',
        region: 'N/A',
        barcode: 'N/A',
        description: 'N/A',
        imageUrl: 'N/A',
        categories: 'N/A',
        variants: 'N/A',
        reviews: 'N/A'
    };
    
    // Helper to safely query text content
    function safeGetText(selector, context = document) {
        try {
            const element = context.querySelector(selector);
            return element ? element.textContent.trim() : 'N/A';
        } catch (e) { console.error(`Error with selector ${selector}:`, e); return 'N/A'; }
    }

    // --- 1. Attempt to get data from JSON-LD structured data ---
    try {
        const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            const jsonData = JSON.parse(jsonLdScript.textContent);
            data.productTitle = jsonData.name || data.productTitle;
            data.brand = jsonData.brand?.name || data.brand;
            data.sku = jsonData.sku || data.sku;
            data.description = jsonData.description || data.description;
            data.imageUrl = jsonData.image?.[0] || data.imageUrl;
            if (jsonData.offers && jsonData.offers.length > 0) {
                const offer = jsonData.offers[0];
                data.regularPrice = offer.price || data.regularPrice;
                data.currency = offer.priceCurrency || data.currency;
                data.availability = offer.availability?.replace('http://schema.org/', '') || data.availability;
                data.barcode = offer.gtin13 || data.barcode;
            }
        }
    } catch (e) {
        console.error("Error parsing JSON-LD data:", e);
    }

    // --- 2. Extract from Product Specifications table for more detail ---
    try {
        const specTable = document.querySelector('.product__accordion table');
        if (specTable) {
            const rows = specTable.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 2) {
                    const key = cells[0].textContent.trim().toLowerCase();
                    const value = cells[1].textContent.trim();
                    switch (key) {
                        case 'brand name': data.brand = value; break;
                        case 'size': data.size = value; break;
                        case 'alcohol content': data.alcoholContent = value; break;
                        case 'type': data.productType = value; break;
                        case 'category': data.categories = value; break;
                        case 'style': data.style = value; break;
                        case 'country': data.country = value; break;
                        case 'region': data.region = value; break;
                        case 'barcode': data.barcode = value; break;
                    }
                }
            });
        }
    } catch(e) {
        console.error("Error parsing product specifications table:", e);
    }
    
    // --- 3. Extract other data from page elements as fallback or supplement ---
    // Use existing logic for variants as it's specific
    const variantRadios = document.querySelector('variant-radios');
    if (variantRadios) {
        const radioInputs = Array.from(variantRadios.querySelectorAll('input[type="radio"]'));
        data.variants = radioInputs.map(input => input.value).join(', ');
    }
    
    data.reviews = safeGetText('.jdgm-prev-badge__text');
    
    // If structured data didn't provide it, try scraping from the visible elements
    if (data.productTitle === 'N/A') data.productTitle = safeGetText('.product__title h1');
    if (data.brand === 'N/A') data.brand = safeGetText('.product__text.caption-with-letter-spacing a');
    if (data.regularPrice === 'N/A') data.regularPrice = safeGetText('.price-item--regular');
    if (data.salePrice === 'N/A') data.salePrice = safeGetText('.price-item--sale');


    console.log("Extracted comprehensive data:", data);
    return data;
}

// TARGET NAVIGATION LOGIC (Visit each collected link)
function continueTargetNavigation() {
  const queue = getTargetNavigationQueue();
  let currentIndex = getCurrentTargetIndex();

  console.log(`Continuing target navigation. On page for item ${currentIndex + 1}/${queue.length}.`);

  // --- NEW: Extract data from the current page ---
  // We only extract if we are on a product page, not a collection page.
  if (window.location.href.includes('/products/')) {
    const extractedData = extractProductData();
    const allData = getExtractedData();
    allData.push(extractedData);
    setExtractedData(allData);
    console.log(`Data for "${extractedData.productTitle}" saved. Total items: ${allData.length}`);
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