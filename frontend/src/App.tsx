import { useEffect, useState } from "react";
import { tasksApi } from "./api";
import type { Task, TaskFields } from "./api";
import TaskForm from "./TaskForm";
import TaskList from "./TaskList";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const openCount = tasks.filter((task) => !task.completed).length;

  async function refreshTasks(signal?: AbortSignal) {
    setLoading(true);
    setListError(null);
    try {
      const loaded = await tasksApi.list(signal);
      if (!signal?.aborted) setTasks(loaded);
    } catch (error) {
      if (!signal?.aborted) setListError(`Could not load tasks. ${errorMessage(error)}`);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void refreshTasks(controller.signal);
    return () => controller.abort();
  }, []);

  function resetForm() {
    setEditingTask(null);
    setFormVersion((version) => version + 1);
  }

  async function mutate(operation: () => Promise<void>, successMessage: string) {
    if (busy) return;
    setBusy(true);
    setMutationError(null);
    setNotice("");
    try {
      await operation();
      setNotice(successMessage);
      // Keep the confirmed result visible even if this refresh fails.
      await refreshTasks();
    } catch (error) {
      setMutationError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveTask(fields: TaskFields) {
    await mutate(async () => {
      const saved = editingTask
        ? await tasksApi.update(editingTask.id, fields)
        : await tasksApi.create(fields);
      setTasks((current) => editingTask
        ? current.map((task) => task.id === saved.id ? saved : task)
        : [saved, ...current]);
      resetForm();
    }, editingTask ? "Task updated." : "Task added.");
  }

  async function toggleTask(task: Task) {
    await mutate(async () => {
      const saved = await tasksApi.update(task.id, { completed: !task.completed });
      setTasks((current) => current.map((item) => item.id === saved.id ? saved : item));
    }, task.completed ? "Task marked as incomplete." : "Task completed.");
  }

  async function deleteTask(task: Task) {
    if (!window.confirm("Delete this task permanently?")) return;
    await mutate(async () => {
      await tasksApi.remove(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      if (editingTask?.id === task.id) resetForm();
    }, "Task deleted.");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true">✓</span><span>Todo</span></div>
        <span className="header-note">A little clarity for your day.</span>
      </header>
      <main>
        <div className="page-heading">
          <span className="eyebrow">YOUR SPACE TO GET THINGS DONE</span>
          <h1>A clearer list. A lighter day.</h1>
          <p>Capture a task, set its priority, and take it one step at a time.</p>
        </div>
        <div className="workspace">
          <div>
            <TaskForm
              key={`${editingTask?.id ?? "new"}-${formVersion}`}
              task={editingTask}
              busy={busy || loading}
              onSave={saveTask}
              onCancel={() => { resetForm(); setMutationError(null); }}
            />
            <div className="feedback" role="status">{busy ? "Saving changes…" : notice}</div>
            {mutationError && <div className="error-message" role="alert">{mutationError}</div>}
          </div>
          <section className="list-panel panel" aria-labelledby="list-heading" aria-busy={loading}>
            <div className="list-heading">
              <div>
                <h2 id="list-heading">Your tasks</h2>
                <p>{tasks.length > 0 ? `${openCount} open · ${tasks.length - openCount} done` : "A place for everything on your mind."}</p>
              </div>
              <button className="button secondary refresh-button" type="button" disabled={busy || loading} onClick={() => void refreshTasks()}>Refresh tasks</button>
            </div>
            {listError && <div className="error-message list-error" role="alert">{listError}</div>}
            {loading && <p className="loading-message" role="status">Loading tasks…</p>}
            {tasks.length > 0 && <TaskList
              tasks={tasks}
              busy={busy || loading}
              editingId={editingTask?.id}
              onEdit={(task) => { setEditingTask(task); setMutationError(null); setNotice(""); }}
              onToggle={toggleTask}
              onDelete={deleteTask}
            />}
            {!loading && !listError && tasks.length === 0 && <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">✓</span>
              <h3>A fresh start</h3>
              <p>No tasks yet. Add your first task to get started.</p>
            </div>}
          </section>
        </div>
      </main>
      <footer>Small steps count.</footer>
    </div>
  );
}
