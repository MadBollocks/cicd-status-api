const test = require("node:test");
const assert = require("node:assert/strict");
const { requestHandler } = require("../src/server");

function call(path) {
  return new Promise((resolve) => {
    const request = { url: path };
    const response = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(body) {
        resolve({ statusCode: this.statusCode, headers: this.headers, body });
      }
    };
    requestHandler(request, response);
  });
}

test("health endpoint returns an OK status", async () => {
  const response = await call("/health");
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).status, "ok");
});

test("unknown routes return 404", async () => {
  const response = await call("/missing");
  assert.equal(response.statusCode, 404);
});
