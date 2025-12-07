async function showReport() {
  const data = await browser.storage.local.get();
  const report = document.getElementById("report");
  report.innerHTML = "";

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    report.innerHTML = '<div style="padding:20px; text-align:center; color:#888">No data yet.</div>';
    return;
  }

  const totalTime = entries.reduce((sum, entry) => sum + entry[1], 0);

  const fragment = document.createDocumentFragment();

  for (let [site, milliseconds] of entries) {
    const row = document.createElement("div");
    row.className = "site-row";

    const percent = Math.max(1, (milliseconds / totalTime) * 100);

    const iconUrl = `https://www.google.com/s2/favicons?domain=${site}&sz=32`;

    row.innerHTML = `
      <div class="progress-bg" style="width: ${percent}%"></div>
      <img class="favicon" src="${iconUrl}" />
      <div class="domain" title="${site}">${site}</div>
      <div class="time">${formatDuration(milliseconds)}</div>
    `;

    fragment.appendChild(row);
  }

  report.appendChild(fragment);
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n) => n.toString().padStart(2, "0");

  if (h > 0) return `${h}h ${pad(m % 60)}m`;
  return `${pad(m % 60)}m ${pad(s % 60)}s`;
}

document.getElementById("clear").addEventListener("click", async () => {
  await browser.storage.local.clear();
  showReport();
});

showReport();
