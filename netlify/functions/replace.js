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

async function downloadFile(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 5000
    });
    return res.data;
  } catch {
    return null;
  }
}

// --------------------
// MAIN HANDLER
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

    // --------------------
    // 1. FORCE TITLE REPLACE
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
    // 3. PARSE HTML FOR ASSETS
    // --------------------
    const $ = cheerio.load(html);

    let assets = [];

    // favicon
    $('link[rel*="icon"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) assets.push(href);
    });

    // images (limit to avoid timeout)
    $('img').each((i, el) => {
      if (i < 8) {
        const src = $(el).attr('src');
        if (src) assets.push(src);
      }
    });

    // remove duplicates
    assets = [...new Set(assets)];

    // convert to absolute URLs
    assets = assets
      .map(a => toAbsolute(a, newCanonical || canonical))
      .filter(Boolean);

    // --------------------
    // 4. CREATE ZIP
    // --------------------
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();

    archive.pipe(stream);

    // add HTML
    archive.append(html, { name: "index.html" });

    // --------------------
    // 5. DOWNLOAD + ADD ASSETS
    // --------------------
    let index = 0;

    for (const url of assets) {
      const file = await downloadFile(url);

      if (file) {
        let ext = "jpg";

        if (url.includes(".png")) ext = "png";
        else if (url.includes(".svg")) ext = "svg";
        else if (url.includes(".ico")) ext = "ico";
        else if (url.includes(".webp")) ext = "webp";

        archive.append(file, {
          name: `assets/file${index}.${ext}`
        });

        index++;
      }
    }

    await archive.finalize();

    // --------------------
    // 6. RETURN ZIP
    // --------------------
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
        error: "Failed to generate clone",
        details: err.message
      })
    };
  }
};
