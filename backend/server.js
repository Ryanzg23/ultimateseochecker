const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const archiver = require("archiver");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// --------------------
// HELPERS
// --------------------

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

async function download(url) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });
    return res.data;
  } catch {
    return null;
  }
}

// --------------------
// CLONE ROUTE
// --------------------

app.post("/clone", async (req, res) => {
  try {
    const { url } = req.body;

    const page = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    let html = page.data;
    const baseUrl = url;

    const $ = cheerio.load(html);

    let files = [];
    let map = {};
    let index = 0;

    async function processAsset(src) {
      const abs = toAbsolute(src, baseUrl);
      if (!abs) return null;

      if (map[abs]) return map[abs];

      const file = await download(abs);
      if (!file) return null;

      const ext = getExt(abs);
      const local = `assets/file${index}.${ext}`;

      map[abs] = local;
      files.push({ file, path: local });

      index++;
      return local;
    }

    // IMAGES
    const imgs = $("img").toArray();
    for (const el of imgs) {
      const src = $(el).attr("src");
      const local = await processAsset(src);
      if (local) $(el).attr("src", local);
    }

    // CSS
    const css = $('link[rel="stylesheet"]').toArray();
    for (const el of css) {
      const href = $(el).attr("href");
      const local = await processAsset(href);
      if (local) $(el).attr("href", local);
    }

    // JS
    const js = $("script[src]").toArray();
    for (const el of js) {
      const src = $(el).attr("src");
      const local = await processAsset(src);
      if (local) $(el).attr("src", local);
    }

    // FAVICON
    const icons = $('link[rel*="icon"]').toArray();
    for (const el of icons) {
      const href = $(el).attr("href");
      const local = await processAsset(href);
      if (local) $(el).attr("href", local);
    }

    // CSS url() rewrite
    for (let f of files) {
      if (f.path.endsWith(".css")) {
        let cssContent = f.file.toString();

        const matches = [...cssContent.matchAll(/url\((.*?)\)/g)];

        for (let m of matches) {
          let raw = m[1].replace(/['"]/g, "");
          const local = await processAsset(raw);
          if (local) cssContent = cssContent.replace(raw, local);
        }

        f.file = Buffer.from(cssContent);
      }
    }

    html = $.html();

    // --------------------
    // ZIP
    // --------------------

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=clone.zip");

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(res);

    archive.append(html, { name: "index.html" });

    for (const f of files) {
      archive.append(f.file, { name: f.path });
    }

    await archive.finalize();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
