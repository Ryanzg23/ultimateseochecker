const cheerio = require("cheerio");
const archiver = require("archiver");

// --------------------
// HELPERS
// --------------------

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAllSafe(html, oldText, newText) {
  if (!oldText || oldText.length < 5) return html;
  return html.replace(new RegExp(escapeRegex(oldText), "gi"), newText);
}

function toAbsolute(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

async function fetchFile(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!res.ok) return null;

    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// --------------------
// MAIN
// --------------------

exports.handler = async (event) => {
  try {
    const data = JSON.parse(event.body);

    let {
      html,
      title,
      description,
      canonical,
      amphtml,
      newTitle,
      newDescription,
      newCanonical,
      newAmp
    } = data;

    const baseUrl = newCanonical || canonical;

    // --------------------
    // REPLACE TEXT
    // --------------------

    html = html.replace(
      /<title[^>]*>.*?<\/title>/i,
      `<title>${newTitle}</title>`
    );

    html = replaceAllSafe(html, title, newTitle);
    html = replaceAllSafe(html, description, newDescription);
    html = replaceAllSafe(html, canonical, newCanonical);
    html = replaceAllSafe(html, amphtml, newAmp);

    const $ = cheerio.load(html);

    let files = [];
    let index = 0;

    async function process(el, attr) {
      let src = $(el).attr(attr);
      if (!src) return;

      const abs = toAbsolute(src, baseUrl);
      if (!abs) return;

      if (index > 6) return; // 🔥 LIMIT (important)

      const file = await fetchFile(abs);
      if (!file) return;

      const ext = abs.split(".").pop().split("?")[0];
      const local = `assets/file${index}.${ext}`;

      $(el).attr(attr, local);

      files.push({ file, path: local });

      index++;
    }

    // IMAGES ONLY (safe for Netlify)
    const imgs = $("img").toArray();
    for (const el of imgs) {
      await process(el, "src");
    }

    // FAVICON
    const icons = $('link[rel*="icon"]').toArray();
    for (const el of icons) {
      await process(el, "href");
    }

    html = $.html();

    // --------------------
    // ZIP (SAFE)
    // --------------------

    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks = [];

    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("error", (err) => { throw err; });

    archive.append(html, { name: "index.html" });

    for (const f of files) {
      archive.append(f.file, { name: f.path });
    }

    await new Promise((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
      archive.finalize();
    });

    const buffer = Buffer.concat(chunks);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=clone.zip"
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};
