"use strict";

const http = require("http");

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const KEEP_ALIVE_INTERVAL =
  Number(process.env.RENDER_KEEPALIVE_INTERVAL) || 10 * 60 * 1000;

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });

    res.end(
      JSON.stringify({
        status: "ok",
        bot: "SIYAM",
        service: "render-keepalive",
        uptime: Math.floor(process.uptime()),
        time: new Date().toISOString()
      })
    );

    return;
  }

  res.writeHead(404, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(
    JSON.stringify({
      status: "not_found"
    })
  );
});

server.listen(PORT, HOST, () => {
  console.log(
    `[RENDER] Keep-alive server running on ${HOST}:${PORT}`
  );
  console.log(
    `[RENDER] Health endpoint: /health`
  );
  console.log(
    `[RENDER] Keep-alive interval: ${KEEP_ALIVE_INTERVAL}ms`
  );
});

function keepAlive() {
  const renderUrl = process.env.RENDER_EXTERNAL_URL;

  if (!renderUrl) {
    console.log(
      "[RENDER] RENDER_EXTERNAL_URL পাওয়া যায়নি। External self-ping বন্ধ আছে।"
    );
    return;
  }

  const url = `${renderUrl.replace(/\/$/, "")}/health`;

  const request = http.get(url, {
    timeout: 30000
  }, (response) => {
    response.resume();

    console.log(
      `[RENDER] Self-ping: ${response.statusCode} ${url}`
    );
  });

  request.on("error", (error) => {
    console.log(
      `[RENDER] Self-ping error: ${error.message}`
    );
  });

  request.on("timeout", () => {
    request.destroy();
    console.log("[RENDER] Self-ping timeout");
  });
}

setInterval(keepAlive, KEEP_ALIVE_INTERVAL);

process.on("SIGTERM", () => {
  console.log("[RENDER] SIGTERM received. Server shutting down...");

  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[RENDER] SIGINT received. Server shutting down...");

  server.close(() => {
    process.exit(0);
  });
});
