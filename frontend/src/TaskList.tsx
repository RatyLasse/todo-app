import type { Task } from "./api";

interface TaskListProps {
  tasks: Task[];
  busy: boolean;
  editingId: number | undefined;
  onEdit: (task: Task) => void;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
}

export default function TaskList({ tasks, busy, editingId, onEdit, onToggle, onDelete }: TaskListProps) {
  return (
    <ul className="task-list" aria-label="Tasks">
      {tasks.map((task) => (
        <li key={task.id}>
          <article className={`task-row${task.completed ? " completed" : ""}${editingId === task.id ? " editing" : ""}`} aria-labelledby={`task-${task.id}`}>
            <input
              type="checkbox"
              checked={task.completed}
              disabled={busy}
              onChange={() => void onToggle(task)}
              aria-label={`Mark ${task.title} as ${task.completed ? "incomplete" : "complete"}`}
            />
            <div className="task-content">
              <h3 id={`task-${task.id}`}>{task.title}</h3>
              <div className="task-metadata">
                <span className={`badge priority-${task.priority}`}>{task.priority} priority</span>
                <span className="badge label-badge">{task.label}</span>
                {task.completed && <span className="done-label">Done</span>}
              </div>
            </div>
            <div className="task-actions">
              <button className="button text-button" type="button"
                onClick={() => onEdit(task)} disabled={busy}
                aria-label={`Edit ${task.title}`}
              >
                Edit
              </button>
              <button className="button text-button delete-button" type="button"
                onClick={() => void onDelete(task)} disabled={busy}
                aria-label={`Delete ${task.title}`}
              >
                Delete
              </button>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
