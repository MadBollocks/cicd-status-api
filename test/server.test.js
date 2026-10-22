const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { requestHandler } = require("../src/server");

function call(path, method = "GET", body) {
  return new Promise((resolve) => {
    const request = new EventEmitter();
    request.url = path;
    request.method = method;
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
    if (body !== undefined) {
      process.nextTick(() => {
        request.emit("data", JSON.stringify(body));
        request.emit("end");
      });
    }
  });
}

test("health endpoint returns an OK status", async () => {
  const response = await call("/health");
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).status, "ok");
});

test("dashboard returns an HTML page", async () => {
  const response = await call("/");
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["Content-Type"], /text\/html/);
  assert.match(response.body, /StudyTrack/);
});

test("status endpoint describes the delivery pipeline", async () => {
  const response = await call("/api/status");
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.project, "StudyTrack");
  assert.deepEqual(body.pipeline, ["GitHub", "Jenkins", "Docker", "Docker Hub", "Kubernetes"]);
});

test("tasks endpoint returns seeded assignments and statistics", async () => {
  const tasks = await call("/api/tasks");
  const stats = await call("/api/stats");
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(tasks.statusCode, 200);
  assert.equal(JSON.parse(tasks.body).length, 3);
  assert.deepEqual(JSON.parse(stats.body), {
    total: 3,
    completed: 1,
    pending: 2,
    completionRate: 33,
    dueThisWeek: ["2026-10-30", "2026-11-02"].filter(
      (date) => date >= today && date <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    ).length,
    overdue: ["2026-10-30", "2026-11-02"].filter((date) => date < today).length
  });
});

test("users can create, complete, filter, and delete a task", async () => {
  const created = await call("/api/tasks", "POST", {
    title: "Prepare demo",
    subject: "DevOps",
    priority: "High",
    dueDate: "2099-01-01"
  });
  const task = JSON.parse(created.body);
  assert.equal(created.statusCode, 201);
  assert.equal(task.title, "Prepare demo");

  const completed = await call(`/api/tasks/${task.id}`, "PATCH", { completed: true });
  assert.equal(completed.statusCode, 200);
  assert.equal(JSON.parse(completed.body).completed, true);

  const filtered = await call("/api/tasks?filter=completed");
  assert.ok(JSON.parse(filtered.body).some((item) => item.id === task.id));

  const deleted = await call(`/api/tasks/${task.id}`, "DELETE");
  assert.equal(deleted.statusCode, 204);
});

test("tasks support search, subject filtering, and editing", async () => {
  const search = await call("/api/tasks?search=Kubernetes&subject=Cloud%20Computing");
  assert.equal(JSON.parse(search.body).length, 1);
  const edited = await call("/api/tasks/1", "PUT", {
    title: "Complete revised report",
    subject: "Cloud Computing",
    priority: "Medium",
    dueDate: "2099-01-01"
  });
  assert.equal(edited.statusCode, 200);
  assert.equal(JSON.parse(edited.body).title, "Complete revised report");
});

test("task creation validates required fields", async () => {
  const response = await call("/api/tasks", "POST", { title: "Missing details" });
  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error, /subject/i);
});

test("unknown routes return 404", async () => {
  const response = await call("/missing");
  assert.equal(response.statusCode, 404);
});
