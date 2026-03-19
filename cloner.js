let originalData = {};
let originalHTML = "";


async function generate() {
  const url = document.getElementById("url").value;

  if (!url) {
    alert("Please enter a URL");
    return;
  }

  const btn = document.querySelector(".generate-btn");
  btn.innerText = "Cloning...";
  btn.disabled = true;

  try {
    const payload = {
      url: document.getElementById("url").value,
      newTitle: document.getElementById("newTitle").value,
      newDescription: document.getElementById("newDescription").value,
      newCanonical: document.getElementById("newCanonical").value,
      newAmp: document.getElementById("newAmp").value
    };
    
    const res = await fetch("https://ultimateseochecker.onrender.com/clone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Clone failed");

    const blob = await res.blob();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clone.zip";
    a.click();

  } catch (err) {
    alert("Error: " + err.message);
  }

  btn.innerText = "Generate Clone";
  btn.disabled = false;
}
