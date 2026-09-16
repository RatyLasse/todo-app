import type { Task } from "./api";

interface TaskListProps {
  tasks: Task[];
  sortByPriority: boolean;
  busy: boolean;
  editingId: number | undefined;
  onEdit: (task: Task) => void;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
}

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

function orderTasks(tasks: Task[], sortByPriority: boolean): Task[] {
  const originalPositions = new Map(tasks.map((task, index) => [task.id, index]));
  const positionOf = (task: Task): number => originalPositions.get(task.id) ?? 0;

  return [...tasks].sort((first, second) => {
    if (first.completed !== second.completed) return first.completed ? 1 : -1;
    if (sortByPriority && !first.completed) {
      const priorityOrder = priorityRank[first.priority] - priorityRank[second.priority];
      if (priorityOrder !== 0) return priorityOrder;
    }
    if (first.completed) {
      const completionOrder = second.updated_at.localeCompare(first.updated_at);
      if (completionOrder !== 0) return completionOrder;
    }
    return positionOf(first) - positionOf(second);
  });
}

export default function TaskList({ tasks, sortByPriority, busy, editingId, onEdit, onToggle, onDelete }: TaskListProps) {
  const orderedTasks = orderTasks(tasks, sortByPriority);

  return (
    <ul className="task-list" aria-label="Tasks">
      {orderedTasks.map((task) => (
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
