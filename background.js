class TimeTracker {
    constructor() {
        this.currentTab = null;
        this.startTime = null;
        this.storage = browser.storage.local;
        this.blockUrl = browser.runtime.getURL("blocked.html");
    }

    init() {
        browser.tabs.onActivated.addListener((info) => this.handleTabChange(info.tabId));
        browser.windows.onFocusChanged.addListener((winId) => this.handleWindowFocus(winId));
        browser.tabs.onUpdated.addListener((tabId, info, tab) => this.handleUrlUpdate(tabId, info, tab));
        browser.runtime.onMessage.addListener((req, sender, sendRes) => this.handleMessage(req, sendRes));

        setInterval(() => this.checkActiveTabLimit(), 5000);
        setInterval(() => this.saveCurrentTime(), 60000);
    }

    async checkActiveTabLimit() {
        if (this.currentTab) {
            await this.checkAndBlock(this.currentTab);
        }
    }

    getTodayKey() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    async shouldTrackDomain(domain) {
        const data = await this.storage.get(["filterMode", "filterList"]);
        const mode = data.filterMode || "all";
        const list = data.filterList || [];

        if (mode === "all") return true;

        const isInList = list.includes(domain);

        if (mode === "include") return isInList;
        if (mode === "exclude") return !isInList;

        return true;
    }

    async saveCurrentTime() {
        if (!this.startTime || !this.currentTab) return;

        const domain = this.getDomainName(this.currentTab.url);

        // Check if we should track this domain
        const shouldTrack = await this.shouldTrackDomain(domain);
        if (!shouldTrack) {
            this.startTime = Date.now();
            return;
        }

        const duration = Date.now() - this.startTime;

        if (duration < CONFIG.MIN_VISIT_DURATION) return;

        const today = this.getTodayKey();

        const data = await this.storage.get(today);
        const dailyData = data[today] || {};

        const newTotal = (dailyData[domain] || 0) + duration;
        dailyData[domain] = newTotal;

        await this.storage.set({ [today]: dailyData });
        this.startTime = Date.now();
    }
    async checkAndBlock(tab) {
        if (!tab || !tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) return;

        const domain = this.getDomainName(tab.url);
        const today = this.getTodayKey();

        const data = await this.storage.get([today, "limits", "blocking"]);

        const dailyData = data[today] || {};
        const timeSpent = dailyData[domain] || 0;

        const limitMins = data.limits ? data.limits[domain] : 0;
        const shouldBlock = data.blocking ? data.blocking[domain] : false;

        let sessionTime = 0;
        if (this.currentTab && this.currentTab.id === tab.id && this.startTime) {
            sessionTime = Date.now() - this.startTime;
        }

        const totalTime = timeSpent + sessionTime;

        if (shouldBlock && limitMins > 0 && totalTime > limitMins * 60 * 1000) {
            browser.tabs.update(tab.id, { url: this.blockUrl });
        }
    }

    async handleTabChange(tabId) {
        await this.saveCurrentTime();
        try {
            this.currentTab = await browser.tabs.get(tabId);
            this.startTime = Date.now();
            await this.checkAndBlock(this.currentTab);
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
            await this.checkAndBlock(tab);
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