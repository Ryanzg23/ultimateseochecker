let originalData = {};
let originalHTML = "";


async function generate() {
  const url = document.getElementById("url").value;

  if (!url) {
    alert("Please enter a URL");
    return;
  }

  // Optional loading indicator
  const btn = document.querySelector(".generate-btn");
  btn.innerText = "Generating...";
  btn.disabled = true;

  try {
    const res = await fetch("https://ultimateseochecker.onrender.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    if (!res.ok) throw new Error("Failed to generate clone");

    const blob = await res.blob();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clone.zip";
    a.click();

  } catch (err) {
    alert("Error: " + err.message);
  }

  btn.innerText = "Generate HTML";
  btn.disabled = false;
}
