import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { labels, priorities, suggestMetadata } from "./api";
import type { Label, Priority, Task, TaskFields } from "./api";

interface TaskFormProps {
  task: Task | null;
  busy: boolean;
  onSave: (fields: TaskFields) => Promise<void>;
  onCancel: () => void;
}

export default function TaskForm({ task, busy, onSave, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [label, setLabel] = useState<Label>(task?.label ?? "other");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const suggestionController = useRef<AbortController | null>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const titleLength = Array.from(title.trim()).length;

  useEffect(() => {
    if (task) titleInput.current?.focus();
  }, [task]);

  useEffect(() => () => suggestionController.current?.abort(), []);

  useEffect(() => {
    if (busy) clearSuggestion();
  }, [busy]);

  function clearSuggestion() {
    suggestionController.current?.abort();
    suggestionController.current = null;
    setSuggesting(false);
    setSuggestionNotice("");
    setSuggestionError(null);
  }

  function validateTitle(): boolean {
    if (titleLength < 1 || titleLength > 200) {
      setTitleError("Enter a title between 1 and 200 characters.");
      titleInput.current?.focus();
      return false;
    }
    setTitleError(null);
    return true;
  }

  async function requestSuggestion() {
    if (busy || suggestionController.current || !validateTitle()) return;
    const controller = new AbortController();
    suggestionController.current = controller;
    setSuggesting(true);
    setSuggestionNotice("");
    setSuggestionError(null);
    try {
      const suggestion = await suggestMetadata(title.trim(), controller.signal);
      // Editing, saving, or leaving the draft invalidates its pending suggestion.
      if (controller.signal.aborted) return;
      setPriority(suggestion.priority);
      setLabel(suggestion.label);
      setSuggestionNotice(suggestion.source === "llm"
        ? "AI suggestion applied. Review or edit it before saving."
        : "AI is unavailable. Default values applied: Medium priority and Other label. Review or edit them before saving.");
    } catch {
      if (!controller.signal.aborted) {
        setSuggestionError("Could not get a suggestion. Try again or choose priority and label manually.");
      }
    } finally {
      if (!controller.signal.aborted) {
        suggestionController.current = null;
        setSuggesting(false);
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !validateTitle()) return;
    clearSuggestion();
    await onSave({ title: title.trim(), priority, label });
  }

  return (
    <section className="form-panel panel" aria-labelledby="form-heading">
      <div className="section-heading">
        {task && <span className="eyebrow">MAKE A CHANGE</span>}
        <h2 id="form-heading">{task ? "Edit task" : "Add a task"}</h2>
        {task && <p>Update the details, then save your changes.</p>}
      </div>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <fieldset disabled={busy}>
          <label htmlFor="task-title">Task title</label>
          <input
            ref={titleInput}
            id="task-title"
            name="title"
            type="text"
            value={title}
            onChange={(event) => {
              clearSuggestion();
              setTitle(event.target.value);
              setTitleError(null);
            }}
            placeholder="e.g. Book a dentist appointment"
            required
            autoComplete="off"
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? "title-help title-error" : "title-help"}
          />
          <p id="title-help" className="field-hint">A short title, up to 200 characters.</p>
          {titleError && <p id="title-error" className="field-error" role="alert">{titleError}</p>}
          <div className="suggestion-controls">
            <button className="button secondary" type="button" disabled={suggesting} onClick={() => void requestSuggestion()}>
              {suggesting ? "Suggesting…" : "Suggest priority and label"}
            </button>
            <p className="field-hint">Optional AI help. Sends this title to OpenRouter when configured.</p>
            {(suggesting || suggestionNotice) && <p className="suggestion-notice" role="status">
              {suggesting ? "Getting a suggestion… You can keep editing or save manually." : suggestionNotice}
            </p>}
            {suggestionError && <p className="field-error" role="alert">{suggestionError}</p>}
          </div>
          <div className="metadata-fields">
            <div>
              <label htmlFor="task-priority">Priority</label>
              <select id="task-priority" value={priority} onChange={(event) => {
                clearSuggestion();
                setPriority(event.target.value as Priority);
              }}>
                {priorities.map((value) => <option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="task-label">Label</label>
              <select id="task-label" value={label} onChange={(event) => {
                clearSuggestion();
                setLabel(event.target.value as Label);
              }}>
                {labels.map((value) => <option key={value} value={value}>{value[0]?.toUpperCase()}{value.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="button primary" type="submit">{task ? "Save changes" : "Add task"}</button>
            {task && <button className="button secondary" type="button" onClick={onCancel}>Cancel editing</button>}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
