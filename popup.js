let updateInterval;

updateUI();
updateInterval = setInterval(updateUI, 1000);

window.addEventListener("unload", () => clearInterval(updateInterval));

async function updateUI() {
    const data = await browser.storage.local.get();

    try {
        const liveData = await browser.runtime.sendMessage({ action: "getLiveStatus" });

        if (liveData && liveData.domain) {
            const currentTotal = data[liveData.domain] || 0;
            data[liveData.domain] = currentTotal + liveData.timeAdded;
        }
    } catch (error) {
        console.log("Could not fetch live data");
    }
    const report = document.getElementById("report");
    const totalTimeEl = document.getElementById("totalTime");

    const entries = Object.entries(data);
    if (entries.length === 0) {
        report.innerHTML = '<div class="empty-state">No activity tracked yet.<br>Start browsing to see data.</div>';
        totalTimeEl.textContent = "0s";
        return;
    }

    const totalTime = entries.reduce((sum, entry) => sum + entry[1], 0);
    totalTimeEl.textContent = formatDuration(totalTime);
    const positions = new Map();
    const rows = report.querySelectorAll(".site-row");
    rows.forEach((row) => positions.set(row.id, row.getBoundingClientRect().top));
    entries
        .toSorted((a, b) => b[1] - a[1])
        .forEach(([site, milliseconds]) => {
            const rowId = "row-" + site.replace(/[^a-zA-Z0-9]/g, "-");
            let row = document.getElementById(rowId);

            const percent = Math.max(1, (milliseconds / totalTime) * 100);
            const timeString = formatDuration(milliseconds);
            const fallbackIcon = getFallbackIcon(site);
            let iconHtml;

            if (fallbackIcon) {
                iconHtml = `<div class="favicon default-icon">${fallbackIcon}</div>`;
            } else {
                const iconUrl = `https://www.google.com/s2/favicons?domain=${site}&sz=32`;
                iconHtml = `<img class="favicon" src="${iconUrl}" onerror="this.style.opacity='0.3'" />`;
            }
            if (row) {
                row.querySelector(".time").textContent = timeString;
                row.querySelector(".progress-bg").style.width = `${percent}%`;
                row.style.order = -milliseconds;
            } else {
                row = document.createElement("div");
                row.className = "site-row";
                row.id = rowId;
                row.style.order = -milliseconds;

                row.innerHTML = `
        <div class="progress-bg" style="width: ${percent}%"></div>
        ${iconHtml}
        <div class="domain" title="${site}">${site}</div>
        <div class="time">${timeString}</div>
      `;
                report.appendChild(row);
            }
        });
    requestAnimationFrame(() => {
        const newRows = report.querySelectorAll(".site-row");
        newRows.forEach((row) => {
            const oldTop = positions.get(row.id);
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
function getFallbackIcon(site) {
    const icons = {
        settings:
            '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
        file: '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
        empty: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
        error: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>'
    };

    if (site === "Local File") return icons.file;
    if ((site === "Empty / New Tab") | (site === "Firefox: newtab")) return icons.empty;
    if (site.startsWith("[") || site.startsWith("Error")) return icons.error;
    if (site.startsWith("Firefox") || site.startsWith("[System]")) return icons.settings;
    return null;
}
function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const pad = (n) => n.toString().padStart(2, "0");

    if (h > 0) return `${h}h ${pad(m % 60)}m`;
    if (m > 0) return `${pad(m)}m ${pad(s % 60)}s`;
    return `${pad(s)}s`;
}

document.getElementById("clear").addEventListener("click", async () => {
    if (confirm("Clear all tracking data?")) {
        await browser.storage.local.clear();
        document.getElementById("report").innerHTML = "";
        updateUI();
    }
});
