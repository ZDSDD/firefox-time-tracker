class PopupUI {
    constructor() {
        this.report = document.getElementById("report");
        this.totalEl = document.getElementById("totalTime");
        this.clearBtn = document.getElementById("clear");

        // Detail View Elements
        this.detailView = document.getElementById("detail-view");
        this.backBtn = document.getElementById("back-btn");
        this.saveBtn = document.getElementById("save-limit");
        this.limitInput = document.getElementById("limit-input");
        this.blockCheck = document.getElementById("block-check");
        this.detailDomain = document.getElementById("detail-domain");
        this.detailTime = document.getElementById("detail-time");

        // Reports View Elements
        this.reportsView = document.getElementById("reports-view");
        this.reportsBtn = document.getElementById("reports-btn");
        this.reportsBackBtn = document.getElementById("reports-back-btn");
        this.dailyReport = document.getElementById("daily-report");
        this.monthlyReport = document.getElementById("monthly-report");

        this.interval = null;
        this.currentSite = null;
    }

    start() {
        this.update();
        this.interval = setInterval(() => this.update(), 1000);

        window.addEventListener("unload", () => clearInterval(this.interval));
        this.clearBtn.addEventListener("click", () => this.handleClear());

        if (this.backBtn) this.backBtn.addEventListener("click", () => this.closeDetail());
        if (this.saveBtn) this.saveBtn.addEventListener("click", () => this.saveLimit());

        if (this.reportsBtn) this.reportsBtn.addEventListener("click", () => this.openReports());
        if (this.reportsBackBtn) this.reportsBackBtn.addEventListener("click", () => this.closeReports());
    }

    async update() {
        const today = this.getTodayKey();

        const data = await browser.storage.local.get([today, "limits"]);

        const dailyUsage = data[today] || {};
        const viewData = { ...dailyUsage, limits: data.limits };

        let activeDomain = null;

        try {
            const live = await browser.runtime.sendMessage({ action: "getLiveStatus" });
            if (live?.domain) {
                viewData[live.domain] = (viewData[live.domain] || 0) + live.timeAdded;
                activeDomain = live.domain;
            }
        } catch (e) {}

        if (this.currentSite) {
            const ms = viewData[this.currentSite] || 0;
            this.detailTime.textContent = Utils.formatTime(ms);
            return;
        }

        this.render(viewData, activeDomain);
    }

    getTodayKey() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    render(data, activeDomain) {
        const limits = data.limits || {};
        const entries = Object.entries(data).filter(([k]) => k !== "limits");

        if (entries.length === 0) {
            this.report.innerHTML = '<div class="empty-state">No activity tracked yet.<br>Start browsing.</div>';
            this.totalEl.textContent = "0s";
            return;
        }

        const totalMs = entries.reduce((sum, [, ms]) => sum + ms, 0);
        this.totalEl.textContent = Utils.formatTime(totalMs);

        const positions = new Map();
        this.report.querySelectorAll(".site-row").forEach((r) => positions.set(r.id, r.getBoundingClientRect().top));

        entries
            .sort((a, b) => b[1] - a[1])
            .forEach(([site, ms]) => {
                const pct = Math.max(1, (ms / totalMs) * 100);
                const limitMinutes = limits[site] || 0;
                this.upsertRow(site, ms, pct, site === activeDomain, limitMinutes);
            });

        this.animateReorder(positions);
    }

    upsertRow(site, ms, pct, isActive, limitMinutes) {
        const id = "row-" + site.replace(/[^a-zA-Z0-9]/g, "-");
        let row = document.getElementById(id);
        const timeStr = Utils.formatTime(ms);

        const isExceeded = limitMinutes > 0 && ms > limitMinutes * 60 * 1000;

        if (!row) {
            row = document.createElement("div");
            row.className = "site-row";
            row.id = id;

            row.addEventListener("click", () => this.openDetail(site));

            const iconHtml = Utils.getIconHtml(site);

            row.innerHTML = `
                <div class="progress-bg"></div>
                ${iconHtml}
                <div class="live-indicator"></div>
                <div class="domain" title="${site}">${site}</div>
                <div class="time"></div>
            `;
            this.report.appendChild(row);
        }

        row.querySelector(".time").textContent = timeStr;
        row.querySelector(".progress-bg").style.width = `${pct}%`;
        row.style.order = -ms;

        if (isActive) {
            row.classList.add("active-row");
        } else {
            row.classList.remove("active-row");
        }

        if (isExceeded) {
            row.classList.add("limit-exceeded");
        } else {
            row.classList.remove("limit-exceeded");
        }
    }

    async openDetail(site) {
        if (!this.detailView) return;
        this.update();
        this.currentSite = site;

        const today = this.getTodayKey();
        const data = await browser.storage.local.get([today, "limits", "blocking"]);

        const dailyData = data[today] || {};
        const ms = dailyData[site] || 0;

        const limits = data.limits || {};
        const blocking = data.blocking || {};

        this.detailDomain.textContent = site;
        this.detailTime.textContent = Utils.formatTime(ms);
        this.limitInput.value = limits[site] || "";
        this.blockCheck.checked = !!blocking[site];
        document.body.classList.add("viewing-details");
    }

    closeDetail() {
        document.body.classList.remove("viewing-details");
        this.currentSite = null;
        this.update();
    }

    async saveLimit() {
        if (!this.currentSite) return;

        const limitVal = parseInt(this.limitInput.value);
        const data = await browser.storage.local.get(["limits", "blocking"]);
        const limits = data.limits || {};
        const blocking = data.blocking || {};

        if (limitVal > 0) {
            limits[this.currentSite] = limitVal;
        } else {
            delete limits[this.currentSite];
        }

        if (this.blockCheck.checked) {
            blocking[this.currentSite] = true;
        } else {
            delete blocking[this.currentSite];
        }

        await browser.storage.local.set({ limits, blocking });
        this.closeDetail();
    }

    async openReports() {
        document.body.classList.add("viewing-reports");
        await this.loadReports();
    }

    closeReports() {
        document.body.classList.remove("viewing-reports");
    }

    async loadReports() {
        const allData = await browser.storage.local.get(null);

        // Filter out non-date keys
        const dateKeys = Object.keys(allData).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));

        if (dateKeys.length === 0) {
            this.dailyReport.innerHTML = '<div class="empty-state">No data yet</div>';
            this.monthlyReport.innerHTML = '<div class="empty-state">No data yet</div>';
            return;
        }

        // Sort dates newest first
        dateKeys.sort().reverse();

        const today = this.getTodayKey();
        let liveTime = 0;
        let liveDomain = null;

        // Get current session time
        try {
            const live = await browser.runtime.sendMessage({ action: "getLiveStatus" });
            if (live?.domain && live?.timeAdded) {
                liveTime = live.timeAdded;
                liveDomain = live.domain;
            }
        } catch (e) {}

        // Daily report
        let dailyHTML = "";
        dateKeys.forEach((dateKey) => {
            const dayData = allData[dateKey];
            let total = Object.entries(dayData).reduce((sum, [, ms]) => sum + ms, 0);

            // Add live session time to today's total
            if (dateKey === today && liveTime > 0) {
                total += liveTime;
            }

            if (total > 0) {
                const formattedDate = this.formatDateKey(dateKey);
                dailyHTML += `
                    <div class="report-item">
                        <span class="report-date">${formattedDate}</span>
                        <span class="report-time">${Utils.formatTime(total)}</span>
                    </div>
                `;
            }
        });
        this.dailyReport.innerHTML = dailyHTML || '<div class="empty-state">No data</div>';

        // Monthly report
        const monthlyData = {};
        dateKeys.forEach((dateKey) => {
            const monthKey = dateKey.substring(0, 7); // YYYY-MM
            const dayData = allData[dateKey];
            let total = Object.entries(dayData).reduce((sum, [, ms]) => sum + ms, 0);

            // Add live session time to current month
            if (dateKey === today && liveTime > 0) {
                total += liveTime;
            }

            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + total;
        });

        let monthlyHTML = "";
        Object.keys(monthlyData)
            .sort()
            .reverse()
            .forEach((monthKey) => {
                const total = monthlyData[monthKey];
                if (total > 0) {
                    const formattedMonth = this.formatMonthKey(monthKey);
                    monthlyHTML += `
                    <div class="report-item">
                        <span class="report-date">${formattedMonth}</span>
                        <span class="report-time">${Utils.formatTime(total)}</span>
                    </div>
                `;
                }
            });
        this.monthlyReport.innerHTML = monthlyHTML || '<div class="empty-state">No data</div>';
    }

    formatDateKey(dateKey) {
        const [year, month, day] = dateKey.split("-");
        const date = new Date(year, month - 1, day);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return "Today";
        } else if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        } else {
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        }
    }

    formatMonthKey(monthKey) {
        const [year, month] = monthKey.split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }

    animateReorder(oldPositions) {
        requestAnimationFrame(() => {
            this.report.querySelectorAll(".site-row").forEach((row) => {
                const oldTop = oldPositions.get(row.id);
                const newTop = row.getBoundingClientRect().top;

                if (oldTop !== undefined && oldTop !== newTop) {
                    const delta = oldTop - newTop;
                    row.style.transform = `translateY(${delta}px)`;
                    row.style.transition = "none";
                    row.offsetHeight;
                    row.style.transition = "transform 0.5s ease, background 0.15s ease";
                    row.style.transform = "";
                }
            });
        });
    }

    async handleClear() {
        if (confirm("Reset data?")) {
            await browser.storage.local.clear();
            this.report.innerHTML = "";
            this.update();
        }
    }
}

const Utils = {
    formatTime(ms) {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const pad = (n) => n.toString().padStart(2, "0");

        if (h > 0) return `${h}h ${pad(m % 60)}m`;
        if (m > 0) return `${pad(m)}m ${pad(s % 60)}s`;
        return `${pad(s)}s`;
    },

    getIconHtml(site) {
        const icons = {
            settings:
                '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
            file: '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
            empty: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
            error: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
        };

        if (site === "Local File") return `<div class="favicon default-icon">${icons.file}</div>`;
        if (site === "Empty / New Tab" || site === "Firefox: newtab")
            return `<div class="favicon default-icon">${icons.empty}</div>`;
        if (site.startsWith("[") || site.startsWith("Error"))
            return `<div class="favicon default-icon">${icons.error}</div>`;
        if (site.startsWith("Firefox") || site.startsWith("[System]"))
            return `<div class="favicon default-icon">${icons.settings}</div>`;

        return `<img class="favicon" src="https://www.google.com/s2/favicons?domain=${site}&sz=32" onerror="this.style.opacity='0.3'" />`;
    }
};

new PopupUI().start();
