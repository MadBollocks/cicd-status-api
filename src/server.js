const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || "1.0.0";
const dashboard = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);

function requestHandler(request, response) {
  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(dashboard);
    return;
  }

  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", version }));
    return;
  }

  if (request.url === "/api/status") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        project: "Student Project Dashboard",
        description: "A simple application delivered through an automated CI/CD pipeline.",
        pipeline: ["GitHub", "Jenkins", "Docker", "Docker Hub", "Kubernetes"],
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
