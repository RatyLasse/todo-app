import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Task } from "./api";

interface TaskListProps {
  tasks: Task[];
  sortByPriority: boolean;
  busy: boolean;
  editingId: number | undefined;
  onEdit: (task: Task) => void;
  onToggle: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
  reorderEnabled: boolean;
  onReorder: (taskIds: number[]) => Promise<void>;
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
    return positionOf(first) - positionOf(second);
  });
}

function moveTask(
  tasks: Task[],
  draggedId: number,
  targetId: number,
  placeAfter: boolean,
): number[] | null {
  const draggedTask = tasks.find((task) => task.id === draggedId);
  const targetTask = tasks.find((task) => task.id === targetId);
  if (draggedTask === undefined || targetTask === undefined || draggedTask.completed !== targetTask.completed) return null;

  const groupIds = tasks.filter((task) => task.completed === draggedTask.completed).map((task) => task.id);
  const draggedIndex = groupIds.indexOf(draggedId);
  const targetIndex = groupIds.indexOf(targetId);
  if (draggedIndex < 0 || targetIndex < 0 || draggedId === targetId) return null;

  groupIds.splice(draggedIndex, 1);
  const adjustedTargetIndex = groupIds.indexOf(targetId);
  groupIds.splice(adjustedTargetIndex + (placeAfter ? 1 : 0), 0, draggedId);
  let groupIndex = 0;
  return tasks.map((task) => task.completed === draggedTask.completed ? groupIds[groupIndex++]! : task.id);
}

export default function TaskList({
  tasks,
  sortByPriority,
  busy,
  editingId,
  onEdit,
  onToggle,
  onDelete,
  reorderEnabled,
  onReorder,
}: TaskListProps) {
  const orderedTasks = orderTasks(tasks, sortByPriority);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const pointerId = useRef<number | null>(null);

  function taskAtPoint(clientX: number, clientY: number): { task: Task; element: HTMLElement } | null {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-task-id]");
    if (element === null || element === undefined) return null;
    const taskId = Number(element.dataset.taskId);
    const task = orderedTasks.find((candidate) => candidate.id === taskId);
    return task === undefined ? null : { task, element };
  }

  function updateDropTarget(clientX: number, clientY: number): void {
    if (draggedId === null) return;
    const target = taskAtPoint(clientX, clientY);
    const draggedTask = orderedTasks.find((task) => task.id === draggedId);
    if (target === null || draggedTask === undefined || target.task.id === draggedId || target.task.completed !== draggedTask.completed) {
      setDropTargetId(null);
      return;
    }
    setDropTargetId(target.task.id);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, task: Task): void {
    if (!reorderEnabled || busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerId.current = event.pointerId;
    setDraggedId(task.id);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void {
    if (pointerId.current !== event.pointerId || draggedId === null) return;
    event.preventDefault();
    updateDropTarget(event.clientX, event.clientY);
  }

  function finishPointerDrag(event: PointerEvent<HTMLButtonElement>): void {
    if (pointerId.current !== event.pointerId || draggedId === null) return;
    event.preventDefault();
    const target = taskAtPoint(event.clientX, event.clientY);
    const bounds = target?.element.getBoundingClientRect();
    const placeAfter = bounds !== undefined && event.clientY > bounds.top + bounds.height / 2;
    const nextOrder = target === null ? null : moveTask(orderedTasks, draggedId, target.task.id, placeAfter);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerId.current = null;
    setDraggedId(null);
    setDropTargetId(null);
    if (nextOrder !== null) void onReorder(nextOrder);
  }

  function handlePointerCancel(event: PointerEvent<HTMLButtonElement>): void {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    setDraggedId(null);
    setDropTargetId(null);
  }

  function handleHandleKeyDown(event: KeyboardEvent<HTMLButtonElement>, task: Task): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const groupTasks = orderedTasks.filter((candidate) => candidate.completed === task.completed);
    const index = groupTasks.findIndex((candidate) => candidate.id === task.id);
    const target = groupTasks[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (target === undefined) return;
    event.preventDefault();
    const nextOrder = moveTask(orderedTasks, task.id, target.id, event.key === "ArrowDown");
    if (nextOrder !== null) void onReorder(nextOrder);
  }

  return (
    <ul className="task-list" aria-label="Tasks">
      {orderedTasks.map((task) => (
        <li key={task.id}>
          <article
            className={`task-row${task.completed ? " completed" : ""}${editingId === task.id ? " editing" : ""}${draggedId === task.id ? " dragging" : ""}${dropTargetId === task.id ? " drag-over" : ""}`}
            aria-labelledby={`task-${task.id}`}
            data-task-id={task.id}
          >
            {reorderEnabled && <button
              className="drag-handle"
              type="button"
              aria-label={`Drag ${task.title} to reorder`}
              disabled={busy}
              onPointerDown={(event) => handlePointerDown(event, task)}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointerDrag}
              onPointerCancel={handlePointerCancel}
              onKeyDown={(event) => handleHandleKeyDown(event, task)}
            >
              <span aria-hidden="true">⠿</span>
            </button>}
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
