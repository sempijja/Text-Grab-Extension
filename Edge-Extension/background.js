// Listener for when the user clicks the extension's toolbar icon.
chrome.action.onClicked.addListener((tab) => {
  // Check if the tab has a URL before sending a message.
  // This prevents errors on special pages like chrome://extensions.
  if (tab.url && !tab.url.startsWith('chrome://')) {
    chrome.tabs.sendMessage(tab.id, { action: "initiateCapture" }, (response) => {
      if (chrome.runtime.lastError) {
        // This error happens if the content script isn't loaded yet.
        // We can inject the script programmatically as a fallback.
        console.warn("Could not send message, trying to inject script. Error: ", chrome.runtime.lastError.message);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).then(() => {
          // After injecting, try sending the message again.
          chrome.tabs.sendMessage(tab.id, { action: "initiateCapture" });
        });
      } else {
        console.log(response?.status || "Message sent.");
      }
    });
  } else {
    console.log("Cannot initiate capture on this page:", tab.url);
  }
});

// Listener for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureVisibleTab") {
    chrome.tabs.captureVisibleTab(
      sender.tab.windowId,
      { format: "png" },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl: dataUrl });
        }
      }
    );
    return true; // Indicates an asynchronous response.
  }
});