const http = require("node:http");

const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || "1.0.0";

function requestHandler(request, response) {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", version }));
    return;
  }

  if (request.url === "/" || request.url === "/api/status") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        project: "CI/CD Status API",
        message: "CI/CD deployment updated successfully!",
        version
      })
    );
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`CI/CD Status API listening on port ${port}`);
  });
}

module.exports = { requestHandler };
