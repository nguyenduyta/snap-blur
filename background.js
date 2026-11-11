// Captures the visible tab and opens the Snap Blur overlay in the same tab.
// The image is passed straight to the page overlay: no storage, no downloads.

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const target = { tabId: tab.id };
    await chrome.scripting.executeScript({ target, files: ["content.js"] });
    await chrome.scripting.executeScript({
      target,
      func: (url) => window.__snapBlur.start(url),
      args: [dataUrl],
    });
  } catch (err) {
    // chrome://, edge://, Web Store and PDF viewer pages cannot be captured or scripted.
    console.warn("Snap Blur failed:", err);
    await chrome.action.setBadgeBackgroundColor({ color: "#d93025", tabId: tab.id });
    await chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 2000);
  }
});
