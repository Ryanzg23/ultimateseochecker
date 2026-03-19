const axios = require("axios");
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
  const regex = new RegExp(escapeRegex(oldText), 'gi');
  return html.replace(regex, newText);
}

function toAbsolute(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

function getExt(url) {
  if (url.includes(".png")) return "png";
  if (url.includes(".svg")) return "svg";
  if (url.includes(".ico")) return "ico";
  if (url.includes(".webp")) return "webp";
  if (url.includes(".gif")) return "gif";
  if (url.includes(".css")) return "css";
  if (url.includes(".js")) return "js";
  return "jpg";
}

async function downloadFile(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Cloner Tool)"
      }
    });
    return res.data;
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
    // FORCE TITLE
    // --------------------
    html = html.replace(
      /<title[^>]*>.*?<\/title>/i,
      `<title>${newTitle}</title>`
    );

    // --------------------
    // GLOBAL REPLACE
    // --------------------
    html = replaceAllSafe(html, canonical, newCanonical);
    html = replaceAllSafe(html, amphtml, newAmp);
    html = replaceAllSafe(html, title, newTitle);
    html = replaceAllSafe(html, description, newDescription);

    // --------------------
    // PARSE HTML
    // --------------------
    const $ = cheerio.load(html);

    let files = [];
    let imgIndex = 0;
    let cssIndex = 0;
    let jsIndex = 0;

    async function processAsset(el, attr, type) {
      let src = $(el).attr(attr);
      if (!src) return;

      const absolute = toAbsolute(src, baseUrl);
      if (!absolute) return;

      const file = await downloadFile(absolute);
      if (!file || file.length === 0) return;

      let localPath;

      if (type === "css") {
        localPath = `./assets/style${cssIndex}.css`;
        cssIndex++;
      } else if (type === "js") {
        localPath = `./assets/script${jsIndex}.js`;
        jsIndex++;
      } else {
        const ext = getExt(absolute);
        localPath = `./assets/img${imgIndex}.${ext}`;
        imgIndex++;
      }

      $(el).attr(attr, localPath);

      files.push({ file, path: localPath });
    }

    // --------------------
    // CSS
    // --------------------
    const cssLinks = $('link[rel="stylesheet"]').toArray();
    for (const el of cssLinks) {
      await processAsset(el, "href", "css");
    }

    // --------------------
    // JS
    // --------------------
    const scripts = $('script[src]').toArray();
    for (const el of scripts) {
      await processAsset(el, "src", "js");
    }

    // --------------------
    // IMAGES
    // --------------------
    const images = $('img').toArray();
    for (const el of images) {
      if (imgIndex > 10) break;
      await processAsset(el, "src", "img");
    }

    // --------------------
    // FAVICON
    // --------------------
    const favicons = $('link[rel*="icon"]').toArray();
    for (const el of favicons) {
      await processAsset(el, "href", "img");
    }

    html = $.html();

    // --------------------
    // ZIP CREATION (FIXED)
    // --------------------
    const archive = archiver("zip", { zlib: { level: 9 } });

const chunks = [];

archive.on("warning", (err) => {
  console.warn(err);
});

archive.on("error", (err) => {
  throw err;
});

// capture stream properly
archive.on("data", (chunk) => {
  chunks.push(chunk);
});

// --------------------
// ADD FILES
// --------------------

archive.append(html, { name: "index.html" });

for (const f of files) {
  archive.append(f.file, { name: f.path });
}

// --------------------
// FINALIZE
// --------------------

await archive.finalize();

// wait for full buffer
const buffer = Buffer.concat(chunks);

// --------------------
// RETURN
// --------------------

return {
  statusCode: 200,
  headers: {
    "Content-Type": "application/zip",
    "Content-Disposition": "attachment; filename=clone.zip"
  },
  body: buffer.toString("base64"),
  isBase64Encoded: true
};
