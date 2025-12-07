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

  entries.forEach(([site, milliseconds]) => {
    const rowId = "row-" + site.replace(/[^a-zA-Z0-9]/g, "-");
    let row = document.getElementById(rowId);

    const percent = Math.max(1, (milliseconds / totalTime) * 100);
    const timeString = formatDuration(milliseconds);

    if (row) {
      row.querySelector(".time").textContent = timeString;
      row.querySelector(".progress-bg").style.width = `${percent}%`;
      row.style.order = -milliseconds;
    } else {
      row = document.createElement("div");
      row.className = "site-row";
      row.id = rowId;
      row.style.order = -milliseconds;

      const iconUrl = `https://www.google.com/s2/favicons?domain=${site}&sz=32`;

      row.innerHTML = `
        <div class="progress-bg" style="width: ${percent}%"></div>
        <img class="favicon" src="${iconUrl}" onerror="this.style.opacity='0.3'" />
        <div class="domain" title="${site}">${site}</div>
        <div class="time">${timeString}</div>
      `;
      report.appendChild(row);
    }
  });
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
