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
  console.log("Attempting to extract detailed product data...");

  const data = {
      pageUrl: window.location.href,
      productTitle: 'N/A',
      regularPrice: 'N/A',
      salePrice: 'N/A',
      description: 'N/A',
      imageUrl: 'N/A',
      variants: 'N/A',
      accordionInfo: 'N/A',
      reviews: 'N/A',
      brand: 'N/A',
      size: 'N/A',
      alcoholContent: 'N/A',
      type: 'N/A',
      category: 'N/A',
      style: 'N/A',
      country: 'N/A',
      region: 'N/A',
      barcode: 'N/A',
      sku: 'N/A',
      categories: 'N/A',
      productId: 'N/A',
      rating: 'N/A',
      wishlistCount: 'N/A'
  };

  function safeGetText(selector, context = document) {
      try {
          const element = context.querySelector(selector);
          return element ? element.textContent.trim() : 'N/A';
      } catch (e) {
          console.error(`Error getting text for selector: ${selector}`, e);
          return 'N/A';
      }
  }

  function safeGetAttribute(selector, attribute, context = document) {
      try {
          const element = context.querySelector(selector);
          return element ? element.getAttribute(attribute) : 'N/A';
      } catch (e) {
          console.error(`Error getting attribute for selector: ${selector}`, e);
          return 'N/A';
      }
  }

  function safeSelectAll(selector, context = document) {
      try {
          return Array.from(context.querySelectorAll(selector));
      } catch (e) {
          console.error(`Error selecting all for selector: ${selector}`, e);
          return [];
      }
  }

  // Extract product title
  data.productTitle = safeGetText('.product__title h1');

  // Extract price information
  const priceContainer = document.querySelector('.price__container');
  if (priceContainer) {
      data.regularPrice = safeGetText('.price-item--regular', priceContainer);
      data.salePrice = safeGetText('.price-item--sale', priceContainer);
  }

  // Extract description
  data.description = safeGetText('.product__description');

  // Extract image URL
  data.imageUrl = safeGetAttribute('.product__media img', 'src');

  // Extract variants
  const variantRadios = document.querySelector('variant-radios');
  if (variantRadios) {
      const radioInputs = safeSelectAll('input[type="radio"]', variantRadios);
      data.variants = radioInputs.map(input => input.value).join(', ');
  }

  // Extract accordion information (Product Specifications)
  const accordion = document.querySelector('.product__accordion');
  if (accordion) {
      const details = safeSelectAll('details', accordion);
      data.accordionInfo = details.map(detail => {
          const title = safeGetText('.accordion__title', detail);
          return title;
      }).join('; ');
  }

  // Extract reviews and rating
  const reviewWidget = document.querySelector('.jdgm-prev-badge');
  if (reviewWidget) {
      data.reviews = safeGetAttribute('.jdgm-prev-badge', 'data-number-of-reviews');
      data.rating = safeGetAttribute('.jdgm-prev-badge', 'data-average-rating');
  }

  // Extract brand
  data.brand = safeGetText('.brand-collection-link');

  // Extract product specifications from the accordion table
  const specTable = document.querySelector('.product__accordion table');
  if (specTable) {
      const rows = safeSelectAll('tr', specTable);
      rows.forEach(row => {
          const key = safeGetText('td:first-child', row).toLowerCase().replace(/\s+/g, '');
          const value = safeGetText('td:last-child', row);
          if (key.includes('brandname')) data.brand = value;
          if (key.includes('size')) data.size = value;
          if (key.includes('alcoholcontent')) data.alcoholContent = value;
          if (key.includes('type')) data.type = value;
          if (key.includes('category')) data.category = value;
          if (key.includes('style')) data.style = value;
          if (key.includes('country')) data.country = value;
          if (key.includes('region')) data.region = value;
          if (key.includes('barcode')) data.barcode = value;
      });
  }

  // Extract SKU and Product ID from the JSON-LD script
  const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
  if (jsonLdScript) {
      try {
          const jsonData = JSON.parse(jsonLdScript.textContent);
          data.sku = jsonData.sku || 'N/A';
          data.productId = jsonData['@id'] ? jsonData['@id'].split('#')[0] : 'N/A';
      } catch (e) {
          console.error('Error parsing JSON-LD:', e);
      }
  }

  // Extract categories from the Klaviyo tracker script
  const klaviyoScript = document.querySelector('script[type="text/javascript"]:contains("klaviyo.push")');
  if (klaviyoScript) {
      try {
          const scriptContent = klaviyoScript.textContent;
          const itemMatch = scriptContent.match(/var item = ({[\s\S]*?});/);
          if (itemMatch) {
              const itemData = JSON.parse(itemMatch[1]);
              data.categories = itemData.Categories ? itemData.Categories.join(', ') : 'N/A';
          }
      } catch (e) {
          console.error('Error parsing Klaviyo script:', e);
      }
  }

  // Extract wishlist count
  const wishlistContainer = document.querySelector('.wishlist-engine');
  if (wishlistContainer) {
      data.wishlistCount = safeGetAttribute('.wishlist-engine', 'data-wishlist_count');
  }

  console.log("Extracted data:", data);
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