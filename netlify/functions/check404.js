export async function handler(event) {

  let url = event.queryStringParameters?.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing url" })
    };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  try {

    const origin = new URL(url).origin;

    const fake404 = origin + "/this-page-should-not-exist-404-test";

    const res404 = await fetch(fake404, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (404 Checker)"
      }
    });

    let redirectHome = false;

    if ([301,302,307,308].includes(res404.status)) {

      const location = res404.headers.get("location");

      if (location) {

        const final = new URL(location, origin);

        if (final.pathname === "/") {
          redirectHome = true;
        }
      }
    }

    const has404 = res404.status === 404;

    /* ==============================
       CHECK 404.html FILE
    ============================== */

    let html404Exists = false;

    try {

      const resFile = await fetch(origin + "/404.html", {
        redirect: "follow"
      });

      if (resFile.status === 200) {
        html404Exists = true;
      }

    } catch {}

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        url: origin,
        has404,
        html404Exists,
        redirectHome
      })
    };

  } catch {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "fetch_failed"
      })
    };

  }

}
