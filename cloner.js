let originalData = {};
let originalHTML = "";

async function analyze() {
  const url = document.getElementById("url").value;

  document.getElementById("loading").style.display = "block";

  const res = await fetch(`/.netlify/functions/cloner?url=${encodeURIComponent(url)}`);
  const data = await res.json();

  document.getElementById("loading").style.display = "none";

  originalData = data;
  originalHTML = data.html;

  document.getElementById("results").style.display = "block";
  document.getElementById("results").innerHTML = `
    <p><b>Title:</b> ${data.title}</p>
    <p><b>Description:</b> ${data.description}</p>
    <p><b>Canonical:</b> ${data.canonical}</p>
    <p><b>AMP:</b> ${data.amphtml}</p>
  `;

  document.getElementById("replaceSection").style.display = "block";
}

async function generate() {
  const payload = {
    html: originalHTML,
    title: originalData.title,
    description: originalData.description,
    canonical: originalData.canonical,
    amphtml: originalData.amphtml,
    newTitle: document.getElementById("newTitle").value,
    newDescription: document.getElementById("newDescription").value,
    newCanonical: document.getElementById("newCanonical").value,
    newAmp: document.getElementById("newAmp").value,
  };

  const res = await fetch("/.netlify/functions/replace", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const blob = await res.blob();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "clone.zip";
  a.click();
}
