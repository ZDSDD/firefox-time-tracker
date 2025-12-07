let currentTab = null;
let startTime = null;

browser.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentTime();
  currentTab = await browser.tabs.get(activeInfo.tabId);
  startTime = Date.now();
});

async function saveCurrentTime() {
  if (currentTab && startTime) {
    const timeSpent = Date.now() - startTime;
    const domain = new URL(currentTab.url).hostname;

    let data = await browser.storage.local.get(domain);
    let totalTime = (data[domain] || 0) + timeSpent;

    await browser.storage.local.set({ [domain]: totalTime });
  }
}
