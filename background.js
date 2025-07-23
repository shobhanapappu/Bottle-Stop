// background.js

// Listen for the "crawl_complete" message from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "crawl_complete") {
        console.log("Crawl complete. Starting target navigation automatically.");
        
        // Find the active tab to send the message to
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab && activeTab.id) {
                // Send a message to the content script to start target navigation
                chrome.tabs.sendMessage(activeTab.id, { action: "start_target_navigation" });
            } else {
                console.error("Could not find an active tab to start target navigation.");
            }
        });
    }
    
    // Return true to indicate you wish to send a response asynchronously
    return true;
}); 