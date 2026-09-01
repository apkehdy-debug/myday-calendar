import { Router, type IRouter, type Response } from "express";
import path from "node:path";
import {
  CreateEventBody,
  CreateTaskBody,
  CreateTagBody,
  DeleteTagParams,
  DeleteEventParams,
  DeleteTaskParams,
  UpdateTagBody,
  UpdateTagParams,
  GetCalendarQueryParams,
  GetDayParams,
  ScheduleTaskBody,
  ScheduleTaskParams,
  ReorderTasksBody,
  UpdateEventBody,
  UpdateEventParams,
  UpdateTaskBody,
  UpdateTaskParams,
} from "@workspace/api-zod";
import { createMyDayService, MyDayError } from "../../../../lib/myday-core";

const router: IRouter = Router();
const service = createMyDayService(path.resolve(process.cwd(), "data", "myday.json"));

function parseDateParam(value: string) {
  return new Date(`${value}T12:00:00`);
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateParam(value).getTime());
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function sendError(res: Response, error: unknown) {
  const status = error instanceof MyDayError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected local error";
  res.status(status).json({ error: message });
}

router.get("/calendar", async (req, res) => {
  const parsed = GetCalendarQueryParams.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, new Error(parsed.error.message));
    return;
  }
  try {
    res.json(await service.getCalendar(parsed.data.month));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/days/:date", async (req, res) => {
  const parsed = GetDayParams.safeParse({ date: parseDateParam(req.params.date) });
  if (!parsed.success || !isValidDate(req.params.date)) {
    sendError(res, new Error("Date must be a valid calendar date"));
    return;
  }
  try {
    res.json(await service.getDay(req.params.date));
  } catch (error) {
    sendError(res, error);
  }
});

router.get("/tags", async (_req, res) => {
  try {
    res.json(await service.getTags());
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/tags", async (req, res) => {
  const parsed = CreateTagBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, new Error(parsed.error.message));
    return;
  }
  try {
    res.status(201).json(await service.createTag(parsed.data));
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/tags/:id", async (req, res) => {
  const params = UpdateTagParams.safeParse(req.params);
  const body = UpdateTagBody.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, new Error("Invalid tag update"));
    return;
  }
  try {
    res.json(await service.updateTag(params.data.id, body.data));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete("/tags/:id", async (req, res) => {
  const params = DeleteTagParams.safeParse(req.params);
  if (!params.success) {
    sendError(res, new Error("Invalid tag id"));
    return;
  }
  try {
    await service.deleteTag(params.data.id);
    res.status(204).send();
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/events", async (req, res) => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, new Error(parsed.error.message));
    return;
  }
  try {
    const event = await service.createEvent({
      ...parsed.data,
      date: dateOnly(parsed.data.date),
    });
    res.status(201).json(event);
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/events/:id", async (req, res) => {
  const params = UpdateEventParams.safeParse(req.params);
  const body = UpdateEventBody.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, new Error("Invalid event update"));
    return;
  }
  try {
    res.json(await service.updateEvent(params.data.id, body.data));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete("/events/:id", async (req, res) => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    sendError(res, new Error("Invalid event id"));
    return;
  }
  try {
    await service.deleteEvent(params.data.id);
    res.status(204).send();
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, new Error(parsed.error.message));
    return;
  }
  try {
    const task = await service.createTask({
      ...parsed.data,
      date: dateOnly(parsed.data.date),
    });
    res.status(201).json(task);
  } catch (error) {
    sendError(res, error);
  }
});

router.patch("/tasks/:id", async (req, res) => {
  const params = UpdateTaskParams.safeParse(req.params);
  const body = UpdateTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, new Error("Invalid task update"));
    return;
  }
  try {
    res.json(await service.updateTask(params.data.id, body.data));
  } catch (error) {
    sendError(res, error);
  }
});

router.delete("/tasks/:id", async (req, res) => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    sendError(res, new Error("Invalid task id"));
    return;
  }
  try {
    await service.deleteTask(params.data.id);
    res.status(204).send();
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/tasks/reorder", async (req, res) => {
  const parsed = ReorderTasksBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, new Error(parsed.error.message));
    return;
  }
  try {
    res.json(await service.reorderTasks(dateOnly(parsed.data.date), parsed.data.taskIds));
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/tasks/:id/schedule", async (req, res) => {
  const params = ScheduleTaskParams.safeParse(req.params);
  const body = ScheduleTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, new Error("Invalid schedule request"));
    return;
  }
  try {
    res.json(await service.scheduleTask(params.data.id, body.data));
  } catch (error) {
    sendError(res, error);
  }
});

export default router;