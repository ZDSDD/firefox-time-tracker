let currentTab = null;
let startTime = null;

browser.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentTime();
  currentTab = await browser.tabs.get(activeInfo.tabId);
  startTime = Date.now();
});

async function saveCurrentTime() {
  if (!startTime) return;

  const timeSpent = Date.now() - startTime;

  let domain;

  if (currentTab && currentTab.url) {
    domain = getDomainName(currentTab.url);
  } else {
    domain = "[System]: Browser/Window Focus Change";
  }

  let data = await browser.storage.local.get(domain);
  let totalTime = (data[domain] || 0) + timeSpent;

  await browser.storage.local.set({ [domain]: totalTime });
}

browser.windows.onFocusChanged.addListener(async (windowId) => {
  await saveCurrentTime();

  if (windowId === browser.windows.WINDOW_ID_NONE) {
    currentTab = null;
    startTime = null;
  } else {
    let tabs = await browser.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      currentTab = tabs[0];
      startTime = Date.now();
    }
  }
});

function getDomainName(url) {
  console.log(url);
  if (!url || url === "about:blank") return "Empty / New Tab";

  if (url.startsWith("about:")) {
    const part = url.split(":")[1].split(/[#?]/)[0];
    return `Firefox: ${part}`;
  }

  if (url.startsWith("moz-extension://")) {
    return "Firefox Extension";
  }

  if (url.startsWith("file:///")) {
    return "Local File";
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.hostname) {
      return urlObj.hostname;
    }
    return `[Non-Standard]: ${urlObj.protocol}`;
  } catch (e) {
    return `[Parse Error]: ${url.substring(0, 50)}`;
  }
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLiveStatus" && startTime && currentTab) {
    const currentElapsedTime = Date.now() - startTime;
    const domain = getDomainName(currentTab.url);

    sendResponse({ domain: domain, timeAdded: currentElapsedTime });
  } else {
    sendResponse({});
  }
});
