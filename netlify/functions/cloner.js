const axios = require("axios");
const cheerio = require("cheerio");

exports.handler = async (event) => {
  const url = event.queryStringParameters.url;

  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Bulk SEO Meta Viewer)"
      }
    });

    const html = res.data;
    const $ = cheerio.load(html);

    const title = $('title').text().trim();

    const description =
      $('meta[name="description"]').attr('content') || '';

    const canonical =
      $('link[rel="canonical"]').attr('href') || '';

    const amphtml =
      $('link[rel="amphtml"]').attr('href') || '';

    return {
      statusCode: 200,
      body: JSON.stringify({
        html,
        title,
        description,
        canonical,
        amphtml
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch page" })
    };
  }
};
