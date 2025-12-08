class TimeTracker {
    constructor() {
        this.currentTab = null;
        this.startTime = null;
        this.storage = browser.storage.local;
    }

    init() {
        browser.tabs.onActivated.addListener((info) => this.handleTabChange(info.tabId));
        browser.windows.onFocusChanged.addListener((winId) => this.handleWindowFocus(winId));
        browser.tabs.onUpdated.addListener((tabId, info, tab) => this.handleUrlUpdate(tabId, info, tab));
        browser.runtime.onMessage.addListener((req, sender, sendRes) => this.handleMessage(req, sendRes));
    }

    async handleTabChange(tabId) {
        await this.saveCurrentTime();
        try {
            this.currentTab = await browser.tabs.get(tabId);
            this.startTime = Date.now();
        } catch (e) {
            this.currentTab = null;
        }
    }

    async handleWindowFocus(winId) {
        await this.saveCurrentTime();

        if (winId === browser.windows.WINDOW_ID_NONE) {
            this.currentTab = null;
            this.startTime = null;
        } else {
            let tabs = await browser.tabs.query({ active: true, windowId: winId });
            if (tabs.length > 0) {
                this.currentTab = tabs[0];
                this.startTime = Date.now();
            }
        }
    }

    async handleUrlUpdate(tabId, info, tab) {
        if (this.currentTab && tabId === this.currentTab.id && info.url) {
            await this.saveCurrentTime();
            this.currentTab = tab;
            this.startTime = Date.now();
        }
    }

    handleMessage(request, sendResponse) {
        if (request.action === "getLiveStatus" && this.startTime && this.currentTab) {
            const currentElapsedTime = Date.now() - this.startTime;
            const domain = this.getDomainName(this.currentTab.url);

            sendResponse({ domain: domain, timeAdded: currentElapsedTime });
        } else {
            sendResponse({});
        }
    }

    async saveCurrentTime() {
        if (!this.startTime || !this.currentTab) return;

        const duration = Date.now() - this.startTime;
        const domain = this.getDomainName(this.currentTab.url);

        const data = await this.storage.get(domain);
        const newTotal = (data[domain] || 0) + duration;

        await this.storage.set({ [domain]: newTotal });
    }

    getDomainName(url) {
        if (!url || url === "about:blank") return "Empty / New Tab";

        if (url.startsWith("about:")) {
            const part = url.split(":")[1].split(/[#?]/)[0];
            return `Firefox: ${part}`;
        }
        if (url.startsWith("moz-extension://")) return "Firefox Extension";
        if (url.startsWith("file:///")) return "Local File";

        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            return "System / Local File";
        }
    }
}

new TimeTracker().init();
