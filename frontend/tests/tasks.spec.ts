import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { Task } from "../src/api";

async function openApp(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add task", exact: true })).toBeEnabled();
}

function deferredSignal(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test.beforeEach(async ({ request }) => {
  const response = await request.get("/api/tasks");
  expect(response.ok()).toBeTruthy();
  const tasks: Task[] = await response.json();
  for (const task of tasks) {
    const deleted = await request.delete(`/api/tasks/${task.id}`);
    expect(deleted.status()).toBe(204);
  }
});

test("create, edit, cancel, complete, reopen, and delete a task", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  await openApp(page);
  await expect(page.getByRole("heading", { name: "A fresh start" })).toBeVisible();
  await page.getByRole("textbox", { name: "Task title" }).fill("  Book dentist appointment  ");
  await page.getByRole("combobox", { name: "Priority" }).selectOption("high");
  await page.getByRole("combobox", { name: "Label" }).selectOption("health");
  await page.getByRole("textbox", { name: "Task title" }).press("Enter");

  const original = page.getByRole("article", { name: "Book dentist appointment", exact: true });
  await expect(original).toBeVisible();
  await expect(original.getByText("high priority", { exact: true })).toBeVisible();
  await expect(original.getByText("health", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("");

  await original.getByRole("button", { name: "Edit Book dentist appointment", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Task title" })).toBeFocused();
  await page.getByRole("textbox", { name: "Task title" }).fill("Discard this edit");
  await page.getByRole("button", { name: "Cancel editing" }).click();
  await expect(original).toBeVisible();

  await original.getByRole("button", { name: "Edit Book dentist appointment", exact: true }).click();
  await page.getByRole("textbox", { name: "Task title" }).fill("Book annual checkup");
  await page.getByRole("combobox", { name: "Priority" }).selectOption("low");
  await page.getByRole("combobox", { name: "Label" }).selectOption("personal");
  await page.getByRole("button", { name: "Save changes" }).click();

  const updated = page.getByRole("article", { name: "Book annual checkup", exact: true });
  await expect(updated.getByText("low priority", { exact: true })).toBeVisible();
  await expect(updated.getByText("personal", { exact: true })).toBeVisible();
  await updated.getByRole("checkbox").click();
  await expect(updated.getByRole("checkbox")).toBeChecked();
  await expect(updated.getByText("Done", { exact: true })).toBeVisible();
  await page.reload();
  await expect(updated.getByRole("checkbox")).toBeChecked();
  await updated.getByRole("checkbox").click();
  await expect(updated.getByRole("checkbox")).not.toBeChecked();
  await expect(updated.getByText("Done", { exact: true })).toHaveCount(0);

  page.once("dialog", (dialog) => void dialog.dismiss());
  await updated.getByRole("button", { name: "Delete Book annual checkup", exact: true }).click();
  await expect(updated).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await updated.getByRole("button", { name: "Delete Book annual checkup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A fresh start" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "A fresh start" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("validate the title without losing form values", async ({ page }) => {
  await openApp(page);
  await page.getByRole("textbox", { name: "Task title" }).fill("   ");
  await page.getByRole("combobox", { name: "Label" }).selectOption("work");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a title between 1 and 200 characters.");
  await expect(page.getByRole("textbox", { name: "Task title" })).toBeFocused();
  await expect(page.getByRole("combobox", { name: "Label" })).toHaveValue("work");

  // JavaScript string length counts UTF-16 units; the API counts Unicode characters.
  const title = "📝".repeat(200);
  await page.getByRole("textbox", { name: "Task title" }).fill(title);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("article", { name: title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("show a failed initial load without a refresh control", async ({ page }) => {
  await page.route("**/api/tasks", (route) => route.fulfill({ status: 503 }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Could not load tasks.");
  await expect(page.getByRole("heading", { name: "A fresh start" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh tasks" })).toHaveCount(0);
});

test("keep the draft and hide server details when saving fails", async ({ page }) => {
  await openApp(page);
  await page.route("**/api/tasks", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 500, json: { detail: "sensitive-provider-details" } })
    : route.continue());
  await page.getByRole("textbox", { name: "Task title" }).fill("Pay invoice");
  await page.getByRole("combobox", { name: "Priority" }).selectOption("high");
  await page.getByRole("combobox", { name: "Label" }).selectOption("finance");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("The server could not complete the request. Please try again.");
  await expect(page.getByText("sensitive-provider-details")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Pay invoice");
  await expect(page.getByRole("combobox", { name: "Priority" })).toHaveValue("high");
  await expect(page.getByRole("combobox", { name: "Label" })).toHaveValue("finance");

  await page.unroute("**/api/tasks");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("article", { name: "Pay invoice", exact: true })).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("failed edits, completion changes, and deletion preserve the task", async ({ page, request }) => {
  const response = await request.post("/api/tasks", { data: { title: "Keep this task" } });
  expect(response.status()).toBe(201);
  await openApp(page);
  await page.route("**/api/tasks/*", (route) => route.fulfill({ status: 500 }));
  const task = page.getByRole("article", { name: "Keep this task", exact: true });
  await task.getByRole("checkbox").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(task.getByRole("checkbox")).not.toBeChecked();
  await task.getByRole("button", { name: "Edit Keep this task", exact: true }).click();
  await page.getByRole("textbox", { name: "Task title" }).fill("Keep these unsaved changes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Keep these unsaved changes");
  await expect(task).toBeVisible();
  await page.getByRole("button", { name: "Cancel editing" }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await task.getByRole("button", { name: "Delete Keep this task", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(task).toBeVisible();
});

test("a confirmed save stays visible when refreshing the list fails", async ({ page, request }) => {
  await openApp(page);
  await page.route("**/api/tasks", (route) => route.request().method() === "GET"
    ? route.fulfill({ status: 503 })
    : route.continue());
  await page.getByRole("textbox", { name: "Task title" }).fill("Saved despite refresh failure");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not load tasks.");
  await expect(page.getByRole("status")).toHaveText("Task added.");
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("");
  await expect(page.getByRole("article", { name: "Saved despite refresh failure", exact: true })).toHaveCount(1);
  const response = await request.get("/api/tasks");
  expect(await response.json()).toHaveLength(1);
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("review and edit an AI suggestion before saving", async ({ page, request }) => {
  await page.route("**/api/task-suggestions", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ title: "Pay invoice today" });
    await route.fulfill({ json: { priority: "high", label: "finance", source: "llm" } });
  });
  await openApp(page);
  await page.getByRole("textbox", { name: "Task title" }).fill("  Pay invoice today  ");
  await page.getByRole("button", { name: "Suggest priority and label" }).click();
  await expect(page.getByRole("status").filter({ hasText: "AI suggestion applied" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Priority" })).toHaveValue("high");
  await expect(page.getByRole("combobox", { name: "Label" })).toHaveValue("finance");
  expect(await (await request.get("/api/tasks")).json()).toEqual([]);

  await page.getByRole("combobox", { name: "Priority" }).selectOption("low");
  await page.getByRole("combobox", { name: "Label" }).selectOption("work");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const task = page.getByRole("article", { name: "Pay invoice today", exact: true });
  await expect(task.getByText("low priority", { exact: true })).toBeVisible();
  await expect(task.getByText("work", { exact: true })).toBeVisible();
  await page.reload();
  await expect(task.getByText("low priority", { exact: true })).toBeVisible();
});

test("missing-key fallback is explained and can be edited and saved", async ({ page }) => {
  // The browser test server uses explicit settings with no key, even if .env exists.
  await openApp(page);
  await page.getByRole("textbox", { name: "Task title" }).fill("Schedule a checkup");
  await page.getByRole("combobox", { name: "Priority" }).selectOption("high");
  await page.getByRole("combobox", { name: "Label" }).selectOption("health");
  await page.getByRole("button", { name: "Suggest priority and label" }).click();
  await expect(page.getByRole("status").filter({ hasText: "AI is unavailable" })).toContainText("Default values applied");
  await expect(page.getByRole("combobox", { name: "Priority" })).toHaveValue("medium");
  await expect(page.getByRole("combobox", { name: "Label" })).toHaveValue("other");
  await page.getByRole("combobox", { name: "Label" }).selectOption("health");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("article", { name: "Schedule a checkup", exact: true }).getByText("health", { exact: true })).toBeVisible();
});

for (const failure of ["server error", "invalid response"] as const) {
  test(`suggestion ${failure} preserves manual values and permits retry`, async ({ page }) => {
    await openApp(page);
    await page.route("**/api/task-suggestions", (route) => route.fulfill(failure === "server error"
      ? { status: 500, json: { detail: "sensitive-provider-details" } }
      : { json: { priority: "urgent", label: "private-label", source: "llm" } }));
    await page.getByRole("textbox", { name: "Task title" }).fill("Prepare report");
    await page.getByRole("combobox", { name: "Priority" }).selectOption("high");
    await page.getByRole("combobox", { name: "Label" }).selectOption("work");
    await page.getByRole("button", { name: "Suggest priority and label" }).click();
    await expect(page.getByRole("alert")).toHaveText("Could not get a suggestion. Try again or choose priority and label manually.");
    await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue("Prepare report");
    await expect(page.getByRole("combobox", { name: "Priority" })).toHaveValue("high");
    await expect(page.getByRole("combobox", { name: "Label" })).toHaveValue("work");
    await expect(page.getByText("sensitive-provider-details")).toHaveCount(0);
    await page.unroute("**/api/task-suggestions");
    await page.getByRole("button", { name: "Suggest priority and label" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "AI is unavailable" })).toBeVisible();
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(page.getByRole("article", { name: "Prepare report", exact: true })).toBeVisible();
  });
}

test("invalid titles are checked before requesting suggestions", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/task-suggestions")) requests.push(request.url());
  });
  await openApp(page);
  for (const title of ["   ", "x".repeat(201)]) {
    await page.getByRole("textbox", { name: "Task title" }).fill(title);
    await page.getByRole("button", { name: "Suggest priority and label" }).click();
    await expect(page.getByRole("alert")).toHaveText("Enter a title between 1 and 200 characters.");
  }
  expect(requests).toEqual([]);
});

for (const action of ["edit title", "edit metadata", "save", "cancel editing"] as const) {
  test(`${action} invalidates a pending suggestion without blocking manual work`, async ({ page, request }) => {
    if (action === "cancel editing") {
      await request.post("/api/tasks", { data: { title: "Original task" } });
    }
    await openApp(page);
    if (action === "cancel editing") {
      await page.getByRole("button", { name: "Edit Original task", exact: true }).click();
    }
    await page.getByRole("textbox", { name: "Task title" }).fill("Pending task");
    const started = deferredSignal();
    const release = deferredSignal();
    await page.route("**/api/task-suggestions", async (route) => {
      started.resolve();
      await release.promise;
      await route.fulfill({ json: { priority: "high", label: "finance", source: "llm" } });
    });
    await page.getByRole("button", { name: "Suggest priority and label" }).click();
    await started.promise;
    await expect(page.getByRole("button", { name: "Suggesting…", exact: true })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Task title" })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Priority" })).toBeEnabled();
    if (action === "edit title") {
      await page.getByRole("textbox", { name: "Task title" }).fill("Changed task");
    } else if (action === "edit metadata") {
      await page.getByRole("combobox", { name: "Priority" }).selectOption("low");
    } else if (action === "save") {
      await page.getByRole("button", { name: "Add task", exact: true }).click();
      await expect(page.getByRole("article", { name: "Pending task", exact: true })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Cancel editing" }).click();
      await expect(page.getByRole("article", { name: "Original task", exact: true })).toBeVisible();
    }
    release.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await expect(page.getByRole("button", { name: "Suggest priority and label" })).toBeEnabled();
    await expect(page.getByRole("combobox", { name: "Priority" })).toHaveValue(action === "edit metadata" ? "low" : "medium");
    await expect(page.getByRole("combobox", { name: "Label" })).toHaveValue("other");
    await expect(page.getByText("AI suggestion applied", { exact: false })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });
}
