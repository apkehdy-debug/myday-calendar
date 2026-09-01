import { app, BrowserWindow, Menu, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMyDayService,
  MyDayError,
  type CreateEventInput,
  type CreateTaskInput,
  type CreateTagInput,
  type ScheduleTaskInput,
  type UpdateTagInput,
  type UpdateEventInput,
  type UpdateTaskInput,
} from "../../../lib/myday-core";
import type { IpcRequest, IpcResponse } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = app.isPackaged;
const iconPath = path.join(__dirname, "../assets/icon.icns");

function getBody(request: IpcRequest) {
  return (request.body ?? {}) as Record<string, unknown>;
}

function getId(pathname: string, prefix: string) {
  return pathname.slice(prefix.length);
}

async function createRequestHandler() {
  const service = createMyDayService(path.join(app.getPath("userData"), "myday.json"));

  return async (request: IpcRequest): Promise<IpcResponse> => {
    try {
      const url = new URL(request.path, "file:///");
      const body = getBody(request);
      const method = request.method.toUpperCase();
      let responseBody: unknown = null;

      if (method === "GET" && url.pathname === "/api/healthz") {
        responseBody = { status: "ok" };
      } else if (method === "GET" && url.pathname === "/api/calendar") {
        responseBody = await service.getCalendar(url.searchParams.get("month") ?? "");
      } else if (method === "GET" && url.pathname.startsWith("/api/days/")) {
        responseBody = await service.getDay(getId(url.pathname, "/api/days/"));
      } else if (method === "GET" && url.pathname === "/api/tags") {
        responseBody = await service.getTags();
      } else if (method === "POST" && url.pathname === "/api/tags") {
        responseBody = await service.createTag(body as unknown as CreateTagInput);
      } else if (method === "PATCH" && url.pathname.startsWith("/api/tags/")) {
        responseBody = await service.updateTag(
          getId(url.pathname, "/api/tags/"),
          body as unknown as UpdateTagInput,
        );
      } else if (method === "DELETE" && url.pathname.startsWith("/api/tags/")) {
        await service.deleteTag(getId(url.pathname, "/api/tags/"));
      } else if (method === "POST" && url.pathname === "/api/events") {
        responseBody = await service.createEvent(body as unknown as CreateEventInput);
      } else if (method === "PATCH" && url.pathname.startsWith("/api/events/")) {
        responseBody = await service.updateEvent(
          getId(url.pathname, "/api/events/"),
          body as unknown as UpdateEventInput,
        );
      } else if (method === "DELETE" && url.pathname.startsWith("/api/events/")) {
        await service.deleteEvent(getId(url.pathname, "/api/events/"));
      } else if (method === "POST" && url.pathname === "/api/tasks") {
        responseBody = await service.createTask(body as unknown as CreateTaskInput);
      } else if (method === "PATCH" && url.pathname.startsWith("/api/tasks/")) {
        responseBody = await service.updateTask(
          getId(url.pathname, "/api/tasks/"),
          body as unknown as UpdateTaskInput,
        );
      } else if (method === "DELETE" && url.pathname.startsWith("/api/tasks/")) {
        await service.deleteTask(getId(url.pathname, "/api/tasks/"));
      } else if (method === "POST" && url.pathname === "/api/tasks/reorder") {
        responseBody = await service.reorderTasks(String(body.date), body.taskIds as string[]);
      } else if (method === "POST" && url.pathname.endsWith("/schedule")) {
        responseBody = await service.scheduleTask(
          getId(url.pathname, "/api/tasks/").replace(/\/schedule$/, ""),
          body as unknown as ScheduleTaskInput,
        );
      } else {
        return { status: 404, statusText: "Not Found", body: { error: "Route not found" } };
      }

      return {
        status: method === "DELETE" ? 204 : 200,
        statusText: "OK",
        body: responseBody,
      };
    } catch (error) {
      const status = error instanceof MyDayError ? error.status : 500;
      const message = error instanceof Error ? error.message : "Unexpected local error";
      return { status, statusText: status === 404 ? "Not Found" : "Error", body: { error: message } };
    }
  };
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 320,
    minHeight: 420,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !isProduction,
    },
  });
  if (isProduction) {
    win.removeMenu();
    win.setMenuBarVisibility(false);
    win.setAutoHideMenuBar(true);
    win.webContents.on("devtools-opened", () => win.webContents.closeDevTools());
  }
  await win.loadFile(path.join(__dirname, "../dist/public/index.html"));
}

app.whenReady().then(async () => {
  if (isProduction) Menu.setApplicationMenu(null);
  const handleRequest = await createRequestHandler();
  ipcMain.handle("myday:request", (_event, request: IpcRequest) => handleRequest(request));
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});