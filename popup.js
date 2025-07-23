// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const crawlBtn = document.getElementById('crawlAllBtn');
    const showResultsBtn = document.getElementById('showResultsBtn');
    const startTargetNavBtn = document.getElementById('startTargetNavBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const statusDiv = document.getElementById('status');
    const linksList = document.getElementById('linksList');

    // Function to get active tab
    async function getActiveTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    // Crawl all pages
    crawlBtn.addEventListener('click', async () => {
        const tab = await getActiveTab();
  if (!tab || !tab.id) return;
        statusDiv.textContent = 'Starting crawl... please wait.';
        linksList.innerHTML = '';
        chrome.tabs.sendMessage(tab.id, { action: "crawl_all_pages" });
    });

    // Show collected links
    showResultsBtn.addEventListener('click', async () => {
        const tab = await getActiveTab();
        if (!tab || !tab.id) return;
        statusDiv.textContent = 'Fetching collected links...';
        chrome.tabs.sendMessage(tab.id, { action: "get_crawl_results" }, (response) => {
            if (chrome.runtime.lastError) {
                statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
                return;
            }
            const links = response && response.links ? response.links : [];
            statusDiv.textContent = `Found ${links.length} links.`;
            linksList.innerHTML = links.map(link => `<li>${link}</li>`).join('');
  });
});

    // Start navigating to collected links to extract data
    startTargetNavBtn.addEventListener('click', async () => {
        const tab = await getActiveTab();
        if (!tab || !tab.id) return;
        statusDiv.textContent = 'Starting target navigation to extract data...';
        chrome.tabs.sendMessage(tab.id, { action: "start_target_navigation" });
    });

    // --- NEW: Download functionality ---

    // Download as JSON
    downloadJsonBtn.addEventListener('click', async () => {
        const tab = await getActiveTab();
  if (!tab || !tab.id) return;
        statusDiv.textContent = 'Fetching data for JSON download...';
        chrome.tabs.sendMessage(tab.id, { action: "get_extracted_data" }, (response) => {
            if (chrome.runtime.lastError) {
                statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
                return;
            }
            const data = response && response.data ? response.data : [];
            if (data.length === 0) {
                statusDiv.textContent = 'No data to download.';
                return;
            }
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: 'products.json',
                saveAs: true
            });
            statusDiv.textContent = `Downloaded ${data.length} items as JSON.`;
  });
});

    // Download as CSV
    downloadCsvBtn.addEventListener('click', async () => {
        const tab = await getActiveTab();
  if (!tab || !tab.id) return;
        statusDiv.textContent = 'Fetching data for CSV download...';
        chrome.tabs.sendMessage(tab.id, { action: "get_extracted_data" }, (response) => {
            if (chrome.runtime.lastError) {
                statusDiv.textContent = "Error: " + chrome.runtime.lastError.message;
                return;
            }
            const data = response && response.data ? response.data : [];
            if (data.length === 0) {
                statusDiv.textContent = 'No data to download.';
                return;
            }
            
            // Convert JSON to CSV with specific column order
            const headers = [
                'productId', 'productUrl', 'imageUrl', 'name', 'brand', 'style', 
                'abv', 'description', 'rating', 'review', 'bundle', 'stock', 
                'nonMemberPrice', 'promoPrice', 'discountPrice', 'memberPrice'
            ];
            const headerLabels = [
                'Product ID', 'Product URL', 'Image URL', 'Name', 'Brand', 'Style',
                'ABV', 'Description', 'Rating', 'Review', 'Bundle', 'Stock',
                'Non-Member Price', 'Promo Price', 'Discount Price', 'Member Price'
            ];
            const csvRows = [headerLabels.join(',')];
            data.forEach(row => {
                const values = headers.map(header => {
                    const escaped = ('' + row[header]).replace(/"/g, '""'); // Escape double quotes
                    return `"${escaped}"`;
    });
                csvRows.push(values.join(','));
});

            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: 'products.csv',
                saveAs: true
            });
            statusDiv.textContent = `Downloaded ${data.length} items as CSV.`;
        });
  });
}); 