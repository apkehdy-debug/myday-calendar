import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type MyDayEvent = {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  color: string;
  sourceTaskId: string | null;
  tagIds: string[];
};

export type MyDayTask = {
  id: string;
  date: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
  scheduledEventId: string | null;
  dueDate: string | null;
  tagIds: string[];
};

export type MyDayTag = {
  id: string;
  name: string;
  color: string;
};

export type MyDayData = {
  events: MyDayEvent[];
  tasks: MyDayTask[];
  tags: MyDayTag[];
};

export type CreateEventInput = {
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  color?: string;
  tagIds?: string[];
};

export type UpdateEventInput = Partial<Omit<CreateEventInput, "date">>;
export type CreateTaskInput = { date: string; title: string; dueDate?: string | null; tagIds?: string[] };
export type UpdateTaskInput = {
  title?: string;
  completed?: boolean;
  position?: number;
  dueDate?: string | null;
  tagIds?: string[];
};
export type ScheduleTaskInput = { startTime: string; endTime: string; color?: string; tagIds?: string[] };
export type CreateTagInput = { name: string; color: string };
export type UpdateTagInput = Partial<CreateTagInput>;
export type CalendarDay = {
  date: string;
  eventCount: number;
  taskCount: number;
  completedTaskCount: number;
  dueTaskCount: number;
  overdueTaskCount: number;
};
export type Day = { date: string; events: MyDayEvent[]; tasks: MyDayTask[] };

export class MyDayError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status = 400,
  ) {
    super(message);
    this.status = status;
    this.name = "MyDayError";
  }
}

const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const isValidDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDate(value).getTime());
const localDateString = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const sortTasks = (tasks: MyDayTask[]) => [...tasks].sort((a, b) => a.position - b.position);
const createId = () => randomUUID();
export const MYDAY_TAG_COLORS = ["#d7d7d2", "#b7b8b4", "#979895", "#777875", "#5b5c59", "#3f403d"] as const;

function assertDate(value: string, label: string) {
  if (!isValidDate(value)) throw new MyDayError(`${label} must be a valid calendar date`);
}

function assertTitle(value: string) {
  if (!value.trim()) throw new MyDayError("Title must not be empty");
}

function assertTagName(value: string) {
  if (!value.trim()) throw new MyDayError("Tag name must not be empty");
  if (value.trim().length > 32) throw new MyDayError("Tag name must be 32 characters or fewer");
}

function assertTagColor(value: string) {
  if (!MYDAY_TAG_COLORS.includes(value as (typeof MYDAY_TAG_COLORS)[number])) {
    throw new MyDayError("Tag color must come from the preset palette");
  }
}

function normalizeTagIds(tagIds: string[] | undefined, tags: MyDayTag[]) {
  const normalized = [...new Set((tagIds ?? []).filter((id) => typeof id === "string" && id))];
  if (normalized.some((id) => !tags.some((tag) => tag.id === id))) {
    throw new MyDayError("Every tag must be a saved tag");
  }
  return normalized;
}

export function createMyDayService(dataPath: string) {
  let queue = Promise.resolve();

  async function read(): Promise<MyDayData> {
    try {
      const raw = await readFile(dataPath, "utf8");
      const data = JSON.parse(raw) as Partial<MyDayData>;
      const tags = Array.isArray(data.tags)
        ? data.tags
          .filter((tag): tag is MyDayTag => Boolean(tag && typeof tag.id === "string" && typeof tag.name === "string" && typeof tag.color === "string"))
          .map((tag) => ({ ...tag, name: tag.name.trim() }))
        : [];
      return {
        events: Array.isArray(data.events)
          ? data.events.map((event) => ({ ...event, tagIds: Array.isArray(event.tagIds) ? event.tagIds : [] }))
          : [],
        tasks: Array.isArray(data.tasks)
          ? data.tasks.map((task) => ({ ...task, dueDate: task.dueDate ?? null, tagIds: Array.isArray(task.tagIds) ? task.tagIds : [] }))
          : [],
        tags,
      };
    } catch {
      const initial: MyDayData = { events: [], tasks: [], tags: [] };
      await write(initial);
      return initial;
    }
  }

  async function write(data: MyDayData) {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
  }

  async function serial<T>(work: () => Promise<T>): Promise<T> {
    let result!: T;
    let failure: unknown;
    const current = queue.then(async () => {
      try {
        result = await work();
      } catch (error) {
        failure = error;
      }
    });
    queue = current.then(() => undefined, () => undefined);
    await current;
    if (failure) throw failure;
    return result;
  }

  return {
    getToday: () => localDateString(),

    getTags: (): Promise<MyDayTag[]> =>
      serial(async () => {
        const data = await read();
        return data.tags;
      }),

    createTag: (input: CreateTagInput): Promise<MyDayTag> =>
      serial(async () => {
        assertTagName(input.name);
        assertTagColor(input.color);
        const data = await read();
        const name = input.name.trim();
        if (data.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
          throw new MyDayError("A tag with that name already exists");
        }
        const tag: MyDayTag = { id: createId(), name, color: input.color };
        data.tags.push(tag);
        await write(data);
        return tag;
      }),

    updateTag: (id: string, input: UpdateTagInput): Promise<MyDayTag> =>
      serial(async () => {
        if (input.name !== undefined) assertTagName(input.name);
        if (input.color !== undefined) assertTagColor(input.color);
        const data = await read();
        const tag = data.tags.find((item) => item.id === id);
        if (!tag) throw new MyDayError("Tag not found", 404);
        const nextName = input.name?.trim() ?? tag.name;
        if (data.tags.some((item) => item.id !== id && item.name.toLowerCase() === nextName.toLowerCase())) {
          throw new MyDayError("A tag with that name already exists");
        }
        tag.name = nextName;
        if (input.color !== undefined) tag.color = input.color;
        await write(data);
        return tag;
      }),

    deleteTag: (id: string): Promise<void> =>
      serial(async () => {
        const data = await read();
        const index = data.tags.findIndex((tag) => tag.id === id);
        if (index < 0) throw new MyDayError("Tag not found", 404);
        data.tags.splice(index, 1);
        data.tasks.forEach((task) => { task.tagIds = task.tagIds.filter((tagId) => tagId !== id); });
        data.events.forEach((event) => { event.tagIds = event.tagIds.filter((tagId) => tagId !== id); });
        await write(data);
      }),

    getCalendar: (month: string): Promise<CalendarDay[]> =>
      serial(async () => {
        if (!/^\d{4}-\d{2}$/.test(month)) throw new MyDayError("Month must use YYYY-MM format");
        const data = await read();
        const days = new Map<string, CalendarDay>();
        const ensure = (date: string) => {
          const current = days.get(date) ?? {
            date,
            eventCount: 0,
            taskCount: 0,
            completedTaskCount: 0,
            dueTaskCount: 0,
            overdueTaskCount: 0,
          };
          days.set(date, current);
          return current;
        };
        data.events.filter((event) => event.date.startsWith(month)).forEach((event) => {
          ensure(event.date).eventCount += 1;
        });
        const today = localDateString();
        data.tasks.forEach((task) => {
          const overdueToday = !task.completed && task.dueDate !== null && task.dueDate < today;
          const summaryDate = overdueToday ? today : task.dueDate ?? task.date;
          if (!summaryDate.startsWith(month)) return;
          const current = ensure(summaryDate);
          current.taskCount += 1;
          if (task.completed) current.completedTaskCount += 1;
          if (task.dueDate !== null) current.dueTaskCount += 1;
          if (overdueToday) current.overdueTaskCount += 1;
        });
        return [...days.values()];
      }),

    getDay: (date: string): Promise<Day> =>
      serial(async () => {
        assertDate(date, "Date");
        const data = await read();
        const regularTasks = data.tasks.filter((task) => task.dueDate === null && task.date === date);
        const dueTasks = data.tasks.filter(
          (task) =>
            task.dueDate === date ||
            (!task.completed && task.dueDate !== null && task.dueDate < localDateString() && date === localDateString()),
        );
        const regularIds = new Set(regularTasks.map((task) => task.id));
        return {
          date,
          events: data.events.filter((event) => event.date === date),
          tasks: sortTasks([...regularTasks, ...dueTasks.filter((task) => !regularIds.has(task.id))]),
        };
      }),

    createEvent: (input: CreateEventInput): Promise<MyDayEvent> =>
      serial(async () => {
        assertDate(input.date, "Event date");
        assertTitle(input.title);
        const data = await read();
        const event: MyDayEvent = {
          id: createId(),
          date: input.date,
          title: input.title.trim(),
          startTime: input.startTime,
          endTime: input.endTime,
          notes: input.notes ?? null,
          color: input.color ?? "lavender",
          sourceTaskId: null,
          tagIds: normalizeTagIds(input.tagIds, data.tags),
        };
        data.events.push(event);
        await write(data);
        return event;
      }),

    updateEvent: (id: string, input: UpdateEventInput): Promise<MyDayEvent> =>
      serial(async () => {
        const data = await read();
        const event = data.events.find((item) => item.id === id);
        if (!event) throw new MyDayError("Event not found", 404);
        if (input.title !== undefined) {
          assertTitle(input.title);
          event.title = input.title.trim();
        }
        if (input.tagIds !== undefined) input.tagIds = normalizeTagIds(input.tagIds, data.tags);
        Object.assign(event, { ...input, title: event.title });
        await write(data);
        return event;
      }),

    deleteEvent: (id: string): Promise<void> =>
      serial(async () => {
        const data = await read();
        const index = data.events.findIndex((event) => event.id === id);
        if (index < 0) throw new MyDayError("Event not found", 404);
        data.events.splice(index, 1);
        data.tasks.forEach((task) => {
          if (task.scheduledEventId === id) task.scheduledEventId = null;
        });
        await write(data);
      }),

    createTask: (input: CreateTaskInput): Promise<MyDayTask> =>
      serial(async () => {
        assertDate(input.date, "Task date");
        if (input.dueDate !== undefined && input.dueDate !== null) assertDate(input.dueDate, "Due date");
        assertTitle(input.title);
        const data = await read();
        const date = input.date;
        const position = data.tasks
          .filter((task) => task.date === date)
          .reduce((highest, task) => Math.max(highest, task.position), -1) + 1;
        const task: MyDayTask = {
          id: createId(),
          date,
          title: input.title.trim(),
          completed: false,
          position,
          createdAt: new Date().toISOString(),
          scheduledEventId: null,
          dueDate: input.dueDate ?? null,
          tagIds: normalizeTagIds(input.tagIds, data.tags),
        };
        data.tasks.push(task);
        await write(data);
        return task;
      }),

    updateTask: (id: string, input: UpdateTaskInput): Promise<MyDayTask> =>
      serial(async () => {
        if (input.title !== undefined) assertTitle(input.title);
        if (input.dueDate !== undefined && input.dueDate !== null) assertDate(input.dueDate, "Due date");
        const data = await read();
        const task = data.tasks.find((item) => item.id === id);
        if (!task) throw new MyDayError("Task not found", 404);
        if (input.tagIds !== undefined) input.tagIds = normalizeTagIds(input.tagIds, data.tags);
        Object.assign(task, input);
        if (input.title !== undefined) task.title = input.title.trim();
        await write(data);
        return task;
      }),

    deleteTask: (id: string): Promise<void> =>
      serial(async () => {
        const data = await read();
        const index = data.tasks.findIndex((task) => task.id === id);
        if (index < 0) throw new MyDayError("Task not found", 404);
        data.tasks.splice(index, 1);
        await write(data);
      }),

    reorderTasks: (date: string, taskIds: string[]): Promise<MyDayTask[]> =>
      serial(async () => {
        assertDate(date, "Task date");
        const data = await read();
        const positions = new Map(taskIds.map((id, index) => [id, index]));
        data.tasks
          .filter((task) => task.date === date && positions.has(task.id))
          .forEach((task) => {
            task.position = positions.get(task.id) ?? task.position;
          });
        await write(data);
        return sortTasks(data.tasks.filter((task) => task.date === date));
      }),

    scheduleTask: (id: string, input: ScheduleTaskInput): Promise<MyDayEvent> =>
      serial(async () => {
        const data = await read();
        const task = data.tasks.find((item) => item.id === id);
        if (!task) throw new MyDayError("Task not found", 404);
        const event: MyDayEvent = {
          id: createId(),
          date: task.date,
          title: task.title,
          startTime: input.startTime,
          endTime: input.endTime,
          notes: null,
          color: input.color ?? "lavender",
          sourceTaskId: task.id,
          tagIds: normalizeTagIds(input.tagIds ?? task.tagIds, data.tags),
        };
        data.events.push(event);
        task.scheduledEventId = event.id;
        task.dueDate = null;
        await write(data);
        return event;
      }),
  };
}