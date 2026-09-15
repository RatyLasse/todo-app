export const priorities = ["low", "medium", "high"] as const;
export const labels = ["work", "personal", "errands", "finance", "health", "other"] as const;

export type Priority = (typeof priorities)[number];
export type Label = (typeof labels)[number];

export interface TaskFields {
  title: string;
  priority: Priority;
  label: Label;
}

export interface Task extends TaskFields {
  id: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value && typeof value.id === "number" && Number.isInteger(value.id) && value.id > 0 &&
    "title" in value && typeof value.title === "string" &&
    "priority" in value && priorities.some((priority) => priority === value.priority) &&
    "label" in value && labels.some((label) => label === value.label) &&
    "completed" in value && typeof value.completed === "boolean" &&
    "created_at" in value && typeof value.created_at === "string" &&
    "updated_at" in value && typeof value.updated_at === "string"
  );
}

async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json" },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("This task no longer exists. Refresh the list to continue.");
    }
    if (response.status === 422) {
      throw new Error("Check the task title, priority, and label, then try again.");
    }
    throw new Error("The server could not complete the request. Please try again.");
  }
  if (response.status === 204) return undefined;

  try {
    return await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
}

function parseTask(value: unknown): Task {
  if (!isTask(value)) throw new Error("The server returned an invalid task. Please refresh the list.");
  return value;
}

export const tasksApi = {
  async list(signal?: AbortSignal): Promise<Task[]> {
    const value = await request("/tasks", { signal });
    if (!Array.isArray(value) || !value.every(isTask)) {
      throw new Error("The server returned an invalid task list. Please try again.");
    }
    return value;
  },

  async create(fields: TaskFields): Promise<Task> {
    return parseTask(await request("/tasks", { method: "POST", body: JSON.stringify(fields) }));
  },

  async update(id: number, fields: Partial<TaskFields & { completed: boolean }>): Promise<Task> {
    return parseTask(await request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(fields) }));
  },

  async remove(id: number): Promise<void> {
    await request(`/tasks/${id}`, { method: "DELETE" });
  },
};
