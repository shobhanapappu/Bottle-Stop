
# Bottle Stop Craft Beer Link Collector & Scraper

This Chrome extension is designed to work with the Bottle Stop website. It automates the collection of product links from the craft beer category and then scrapes detailed information from each product page.

## Features

- **Multi-page Crawling**: Automatically navigates through all pages of the craft beer collection to gather product links.
- **Link Collection**: Collects all unique product links from the collection pages.
- **Detailed Product Scraping**: Navigates to each collected product link to extract a comprehensive set of data, including:
  - Product Title & Brand
  - SKU & Product ID
  - Price (Regular and Sale)
  - Availability & Stock Status
  - Product Specifications (Size, Alcohol Content, Style, Country, Region, etc.)
  - Description & Image URL
  - Variants, Reviews, and Ratings
- **Data Export**: Allows you to download the scraped data in both JSON and CSV formats.
- **State Persistence**: Uses `localStorage` to save progress, so you can close the popup or refresh the page without losing your collected links or scraped data.

## How to Use

1. **Navigate to the Craft Beer Collection**: Open the [Bottle Stop Craft Beer](https://bottle-stop.com.au/collections/craft-beer) page.
2. **Start Crawling**: Click the extension icon and then click "Crawl All Pages". The extension will begin to navigate through the pages and collect links.
3. **View Collected Links (Optional)**: Click "Show Collected Links" to see the links that have been gathered so far.
4. **Start Data Extraction**: Once the crawl is complete, click "Start Target Navigation & Extract Data". The extension will then visit each product page and scrape the data.
5. **Download Data**: After the data extraction is complete (or even during the process), click "Download as JSON" or "Download as CSV" to save the data to your computer.

## Files

- `manifest.json`: Defines the extension's properties, permissions, and scripts.
- `popup.html`: The HTML structure for the extension's popup control panel.
- `popup.js`: Handles the logic for the popup buttons and communication with the content script.
- `content.js`: The core script that interacts with the Bottle Stop website. It manages the crawling process, link collection, and detailed data extraction.
- `background.js`: A service worker for handling background tasks, such as the download process.
- `content copy.js`, `content_original.js`: Seem to be backup or older versions of the content script. 