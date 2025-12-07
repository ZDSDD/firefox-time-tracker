async function showReport() {
  const data = await browser.storage.local.get();
  const report = document.getElementById("report");

  for (let [site, milliseconds] of Object.entries(data)) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const displayHours = hours;
    const displayMinutes = minutes % 60;
    const displaySeconds = seconds % 60;

    const timeString = `${displayHours}h ${displayMinutes}m ${displaySeconds}s`;

    report.innerHTML += `<div class="site">${site}: ${timeString}</div>`;
  }
}

document.getElementById("clear").addEventListener("click", async () => {
  await browser.storage.local.clear();
  location.reload();
});

showReport();
