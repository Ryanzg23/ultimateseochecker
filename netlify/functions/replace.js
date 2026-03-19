const axios = require("axios");
const cheerio = require("cheerio");
const archiver = require("archiver");
const { PassThrough } = require("stream");

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
  return "jpg";
}

async function downloadFile(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 7000
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
    // 1. FORCE TITLE
    // --------------------
    html = html.replace(
      /<title[^>]*>.*?<\/title>/i,
      `<title>${newTitle}</title>`
    );

    // --------------------
    // 2. GLOBAL REPLACEMENTS
    // --------------------
    html = replaceAllSafe(html, canonical, newCanonical);
    html = replaceAllSafe(html, amphtml, newAmp);

    html = replaceAllSafe(html, title, newTitle);
    html = replaceAllSafe(html, description, newDescription);

    // --------------------
    // 3. PARSE HTML
    // --------------------
    const $ = cheerio.load(html);

    let assetsMap = {}; // original → local
    let assetIndex = 0;

    async function processAsset(el, attr) {
      let src = $(el).attr(attr);
      if (!src) return;

      const absolute = toAbsolute(src, baseUrl);
      if (!absolute) return;

      // skip duplicates
      if (assetsMap[absolute]) {
        $(el).attr(attr, assetsMap[absolute]);
        return;
      }

      // limit to avoid timeout
      if (assetIndex > 12) return;

      const file = await downloadFile(absolute);
      if (!file) return;

      const ext = getExt(absolute);
      const localPath = `assets/file${assetIndex}.${ext}`;

      assetsMap[absolute] = localPath;

      $(el).attr(attr, localPath);

      assetIndex++;

      return { file, path: localPath };
    }

    let files = [];

    // --------------------
    // 4. FAVICON
    // --------------------
    const faviconEl = $('link[rel*="icon"]');
    for (let i = 0; i < faviconEl.length; i++) {
      const res = await processAsset(faviconEl[i], 'href');
      if (res) files.push(res);
    }

    // --------------------
    // 5. IMAGES
    // --------------------
    const images = $('img');
    for (let i = 0; i < images.length; i++) {
      const res = await processAsset(images[i], 'src');
      if (res) files.push(res);
    }

    // --------------------
    // FINAL HTML
    // --------------------
    html = $.html();

    // --------------------
    // 6. CREATE ZIP
    // --------------------
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();

    archive.pipe(stream);

    // add HTML
    archive.append(html, { name: "index.html" });

    // add assets
    for (const f of files) {
      archive.append(f.file, { name: f.path });
    }

    await archive.finalize();

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

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
        error: "Clone failed",
        details: err.message
      })
    };
  }
};
