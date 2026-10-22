const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT || 8080);
const version = process.env.APP_VERSION || "1.0.0";
const dashboard = fs.readFileSync(
  path.join(__dirname, "..", "public", "index.html"),
  "utf8"
);

const seedTasks = [
  {
    id: 1,
    title: "Complete Kubernetes report",
    subject: "Cloud Computing",
    priority: "High",
    dueDate: "2026-10-30",
    completed: false
  },
  {
    id: 2,
    title: "Revise software testing notes",
    subject: "Software Engineering",
    priority: "Medium",
    dueDate: "2026-11-02",
    completed: false
  },
  {
    id: 3,
    title: "Submit database design",
    subject: "Database Systems",
    priority: "Low",
    dueDate: "2026-10-18",
    completed: true
  }
];

let tasks = seedTasks.map((task) => ({ ...task }));
let nextId = 4;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Request body must be valid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function validateTask(input) {
  const allowedPriorities = ["Low", "Medium", "High"];
  if (!input || typeof input.title !== "string" || !input.title.trim()) {
    return "A task title is required";
  }
  if (!input.subject || typeof input.subject !== "string") {
    return "A subject is required";
  }
  if (!allowedPriorities.includes(input.priority)) {
    return "Priority must be Low, Medium, or High";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate || "")) {
    return "Due date must use YYYY-MM-DD format";
  }
  return null;
}

function getStats() {
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length;
  const today = new Date();
  const todayString = today.toISOString().slice(0, 10);
  const weekAhead = new Date(today);
  weekAhead.setDate(today.getDate() + 7);
  const weekString = weekAhead.toISOString().slice(0, 10);
  return {
    total,
    completed,
    pending: total - completed,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    dueThisWeek: tasks.filter(
      (task) => !task.completed && task.dueDate >= todayString && task.dueDate <= weekString
    ).length,
    overdue: tasks.filter(
      (task) => !task.completed && task.dueDate < todayString
    ).length
  };
}

async function requestHandler(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const taskMatch = url.pathname.match(/^\/api\/tasks\/(\d+)$/);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(dashboard);
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, { status: "ok", version });
    return;
  }

  if (url.pathname === "/api/status") {
    sendJson(response, 200, {
      project: "StudyTrack",
      description: "A student assignment manager delivered through an automated CI/CD pipeline.",
      pipeline: ["GitHub", "Jenkins", "Docker", "Docker Hub", "Kubernetes"],
      message: "StudyTrack is running successfully.",
      version
    });
    return;
  }

  if (url.pathname === "/api/tasks" && request.method === "GET") {
    const filter = url.searchParams.get("filter");
    const search = (url.searchParams.get("search") || "").toLowerCase();
    const subject = url.searchParams.get("subject");
    const requestedSort = url.searchParams.get("sort");
    const sort = ["dueDate", "priority", "title"].includes(requestedSort)
      ? requestedSort
      : "dueDate";
    let filteredTasks = filter === "completed"
      ? tasks.filter((task) => task.completed)
      : filter === "pending"
        ? tasks.filter((task) => !task.completed)
        : tasks;
    if (search) {
      filteredTasks = filteredTasks.filter((task) =>
        `${task.title} ${task.subject}`.toLowerCase().includes(search)
      );
    }
    if (subject && subject !== "all") {
      filteredTasks = filteredTasks.filter((task) => task.subject === subject);
    }
    filteredTasks.sort((first, second) => sort === "priority"
      ? { High: 0, Medium: 1, Low: 2 }[first.priority] - { High: 0, Medium: 1, Low: 2 }[second.priority]
      : first[sort].localeCompare(second[sort]));
    sendJson(response, 200, filteredTasks);
    return;
  }

  if (url.pathname === "/api/stats" && request.method === "GET") {
    sendJson(response, 200, getStats());
    return;
  }

  if (url.pathname === "/api/subjects" && request.method === "GET") {
    sendJson(response, 200, [...new Set(tasks.map((task) => task.subject))].sort());
    return;
  }

  if (url.pathname === "/api/analytics" && request.method === "GET") {
    const bySubject = [...new Set(tasks.map((task) => task.subject))].map((subject) => {
      const subjectTasks = tasks.filter((task) => task.subject === subject);
      return {
        subject,
        total: subjectTasks.length,
        completed: subjectTasks.filter((task) => task.completed).length
      };
    });
    sendJson(response, 200, { bySubject, upcoming: tasks.filter((task) => !task.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3) });
    return;
  }

  if (url.pathname === "/api/tasks" && request.method === "POST") {
    try {
      const input = await readBody(request);
      const error = validateTask(input);
      if (error) {
        sendJson(response, 400, { error });
        return;
      }
      const task = {
        id: nextId++,
        title: input.title.trim(),
        subject: input.subject.trim(),
        priority: input.priority,
        dueDate: input.dueDate,
        completed: false
      };
      tasks.push(task);
      sendJson(response, 201, task);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (taskMatch && (request.method === "PATCH" || request.method === "PUT")) {
    const task = tasks.find((item) => item.id === Number(taskMatch[1]));
    if (!task) {
      sendJson(response, 404, { error: "Task not found" });
      return;
    }
    try {
      const input = await readBody(request);
      if (request.method === "PATCH") {
        if (typeof input.completed !== "boolean") {
          sendJson(response, 400, { error: "Completed must be true or false" });
          return;
        }
        task.completed = input.completed;
      } else {
        const error = validateTask(input);
        if (error) {
          sendJson(response, 400, { error });
          return;
        }
        task.title = input.title.trim();
        task.subject = input.subject.trim();
        task.priority = input.priority;
        task.dueDate = input.dueDate;
        task.completed = Boolean(input.completed);
      }
      sendJson(response, 200, task);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  if (taskMatch && request.method === "DELETE") {
    const index = tasks.findIndex((item) => item.id === Number(taskMatch[1]));
    if (index === -1) {
      sendJson(response, 404, { error: "Task not found" });
        return;
    }
    tasks.splice(index, 1);
    response.writeHead(204);
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`StudyTrack listening on port ${port}`);
  });
}

module.exports = { requestHandler };
