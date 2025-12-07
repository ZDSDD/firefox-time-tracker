async function showReport() {
  const data = await browser.storage.local.get();
  const report = document.getElementById("report");

  for (let [site, milliseconds] of Object.entries(data)) {
    const minutes = Math.round(milliseconds / 60000);
    report.innerHTML += `<div class="site">${site}: ${minutes} minutes</div>`;
  }
}

document.getElementById("clear").addEventListener("click", async () => {
  await browser.storage.local.clear();
  location.reload();
});

showReport();
