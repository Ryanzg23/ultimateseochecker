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
  const clean = url.split("?")[0];

  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "jpg";
  if (clean.endsWith(".svg")) return "svg";
  if (clean.endsWith(".ico")) return "ico";
  if (clean.endsWith(".webp")) return "webp";
  if (clean.endsWith(".gif")) return "gif";
  if (clean.endsWith(".css")) return "css";
  if (clean.endsWith(".js")) return "js";

  return "bin";
}

async function downloadFile(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 10000,
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
    // TEXT REPLACEMENT
    // --------------------

    html = html.replace(
      /<title[^>]*>.*?<\/title>/i,
      `<title>${newTitle}</title>`
    );

    html = replaceAllSafe(html, canonical, newCanonical);
    html = replaceAllSafe(html, amphtml, newAmp);
    html = replaceAllSafe(html, title, newTitle);
    html = replaceAllSafe(html, description, newDescription);

    // --------------------
    // PARSE HTML
    // --------------------

    const $ = cheerio.load(html);

    let files = [];
    let assetMap = {};
    let index = 0;

    async function processAsset(url) {
      const absolute = toAbsolute(url, baseUrl);
      if (!absolute) return null;

      if (assetMap[absolute]) return assetMap[absolute];

      const file = await downloadFile(absolute);
      if (!file || file.length === 0) return null;

      const ext = getExt(absolute);
      const localPath = `assets/file${index}.${ext}`;

      assetMap[absolute] = localPath;

      files.push({ file, path: localPath });

      index++;

      return localPath;
    }

    // --------------------
    // HTML ASSETS
    // --------------------

    // IMAGES
    const images = $('img').toArray();
    for (const el of images) {
      const src = $(el).attr("src");
      const local = await processAsset(src);
      if (local) $(el).attr("src", local);
    }

    // CSS
    const cssLinks = $('link[rel="stylesheet"]').toArray();
    for (const el of cssLinks) {
      const href = $(el).attr("href");
      const local = await processAsset(href);
      if (local) $(el).attr("href", local);
    }

    // JS
    const scripts = $('script[src]').toArray();
    for (const el of scripts) {
      const src = $(el).attr("src");
      const local = await processAsset(src);
      if (local) $(el).attr("src", local);
    }

    // FAVICON
    const favicons = $('link[rel*="icon"]').toArray();
    for (const el of favicons) {
      const href = $(el).attr("href");
      const local = await processAsset(href);
      if (local) $(el).attr("href", local);
    }

    // --------------------
    // CSS URL(...) REWRITE
    // --------------------

    for (let f of files) {
      if (f.path.endsWith(".css")) {
        let cssContent = f.file.toString();

        const urls = [...cssContent.matchAll(/url\((.*?)\)/g)];

        for (let match of urls) {
          let raw = match[1].replace(/['"]/g, "");

          const absolute = toAbsolute(raw, baseUrl);
          if (!absolute) continue;

          const local = await processAsset(absolute);
          if (!local) continue;

          cssContent = cssContent.replace(raw, local);
        }

        f.file = Buffer.from(cssContent);
      }
    }

    html = $.html();

    // --------------------
    // ZIP
    // --------------------
console.log("FILES COUNT:", files.length);
    
    const archive = archiver("zip", { zlib: { level: 9 } });
    
    let buffers = [];
    
    archive.on("data", (chunk) => buffers.push(chunk));
    archive.on("error", (err) => { throw err; });
    
    // ADD FILES FIRST
    archive.append(html, { name: "index.html" });
    
    for (const f of files) {
      archive.append(f.file, { name: f.path });
    }
    
    // FINALIZE
    await new Promise((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
      archive.finalize();
    });
    
    // BUILD BUFFER AFTER FULL COMPLETE
    const buffer = Buffer.concat(buffers);
    
    // RETURN
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=clone.zip"
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true
    };
    
};
