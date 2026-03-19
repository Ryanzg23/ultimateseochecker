function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function replaceAllFlexible(html, oldText, newText) {
  if (!oldText || oldText.length < 5) return html;

  const normalizedOld = normalizeText(oldText);

  const regex = new RegExp(escapeRegex(oldText), 'gi');

  return html.replace(regex, newText);
}

function replaceAllSafe(html, oldText, newText) {
  if (!oldText || oldText.length < 5) return html;

  const escaped = escapeRegex(oldText);

  // CASE INSENSITIVE 🔥
  const regex = new RegExp(escaped, 'gi');

  return html.replace(regex, newText);
}

exports.handler = async (event) => {
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
  
// FORCE title tag
html = html.replace(
  /<title[^>]*>.*?<\/title>/i,
  `<title>${newTitle}</title>`
);

// GLOBAL replace (case-insensitive)
html = replaceAllFlexible(html, title, newTitle);
  
  // URL replacements first
  html = replaceAllSafe(html, canonical, newCanonical);
  html = replaceAllSafe(html, amphtml, newAmp);


  html = replaceAllSafe(html, description, newDescription);
  

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": "attachment; filename=index.html"
    },
    body: html
  };
};
