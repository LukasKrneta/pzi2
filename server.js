const http = require("node:http");
const fs = require("node:fs");
const mime = require("mime-types");

const handlers = require("./handlers.js");

const PORT = 8080;
const PUBLIC = "./public";

function statickeDatoteke(request, response, pathname) {
  let url = pathname;
  if (url == "/") {
    url = "/index.html";
  }

  try {
    let datoteka = PUBLIC + url;
    let content = fs.readFileSync(datoteka);
    const mimeType = mime.lookup(datoteka);
    let headers = {};
    headers["Content-Type"] = mimeType;
    response.writeHead(200, headers);
    response.write(content);
  } catch (e) {
    response.writeHead(404, "Nema datoteke: " + url);
  }

  response.end();
}

function hendlanjeZahtjeva(request, response) {
  let myURL = new URL(request.url, "http://vern.hr");
  let pathname = myURL.pathname;
  let params = myURL.searchParams;

  let body = "";
  request.on("data", function (chunk) {
    body = body + chunk.toString();
  });
  request.on("end", function () {
    if (body != "") {
      if (
        request.headers["content-type"] ==
        "application/x-www-form-urlencoded; charset=UTF-8"
      ) {
        myURL = new URL("/?" + body, "http://vern.hr");
        params = myURL.searchParams;
        let x = {};
        params.forEach((value, key) => {
          x[key] = value;
        });
        params = x;
      } else if (
        request.headers["content-type"] == "application/json; charset=UTF-8"
      ) {
        params = JSON.parse(body);
      }
    } else {
      let x = {};
      params.forEach((value, key) => {
        x[key] = value;
      });
      params = x;
    }

    // -------------------------------
    // NEW, CORRECTED ROUTING LOGIC
    // -------------------------------
    const handlerFunkcija = handlers.get(request.method + " " + pathname);

    if (handlerFunkcija != undefined) {
      try {
        handlerFunkcija(request, response, params);
      } catch (error) {
        response.writeHead(500, "desio se bubu " + error);
        response.end();
      }
      return; // 🔥 CRITICAL: Prevent double response
    }

    // Only serve static files when no handler exists
    statickeDatoteke(request, response, pathname);
  });
}

const server = http.createServer(hendlanjeZahtjeva);
server.listen(PORT, () => {
  console.log(`Server je pokrenut na portu ${PORT}`);
});
