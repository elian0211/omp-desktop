/* app/plan-pill.js — summary + expanded preview for the composer's plan
   pill (design/chat/plan-pill.jsx). Input is omp's raw TodoPhase[]
   ({ name, tasks: [{ content, status, blocker? }] }), the same shape
   ompweb's TodoList renders — not the design kanban remap, which collapses
   blocked/abandoned and drops blockers. Clicking the capsule expands the
   list upward above the pill. Dependency-free IIFE. */
(function () {
  const PREVIEW_TASKS = 5;
  const PREVIEW_PHASES = 4;

  function flatTasks(phases) {
    const cols = Array.isArray(phases) ? phases : [];
    const tasks = [];
    for (const phase of cols) {
      if (!phase || !Array.isArray(phase.tasks)) continue;
      for (const task of phase.tasks) {
        if (!task || typeof task.content !== "string") continue;
        tasks.push({
          phase: phase.name ?? "",
          content: task.content,
          status: task.status,
          blocker: typeof task.blocker === "string" ? task.blocker : null,
        });
      }
    }
    return tasks;
  }

  function summary(phases) {
    const tasks = flatTasks(phases);
    if (tasks.length === 0) return null;
    // Match ompweb: only `completed` counts as done in the progress fraction.
    const done = tasks.filter(t => t.status === "completed").length;
    const inProg = tasks.find(t => t.status === "in_progress") ?? null;
    const focus = inProg ?? tasks.find(t => t.status === "pending") ?? null;
    const phaseTitle = focus ? focus.phase : tasks[tasks.length - 1].phase;
    // Settled plan: every task is completed or abandoned (ompweb's progress
    // can still read done < total when some are abandoned).
    const allDone = tasks.every(t => t.status === "completed" || t.status === "abandoned");
    return {
      total:   tasks.length,
      done,
      allDone,
      pct:     Math.round((done / tasks.length) * 100),
      current: inProg ? inProg.content : null,
      next:    !inProg && focus ? focus.content : null,
      phaseTitle,
    };
  }

  /** Collapsed-preview order: in_progress first, then completed, so a long
   * first phase can't hide the live work (ompweb TodoList). */
  function previewTaskOrder(status) {
    if (status === "in_progress") return 0;
    if (status === "completed") return 1;
    return 2;
  }

  /** Phases/tasks to show in the expanded panel before "Show all". */
  function previewPhases(phases, showAll) {
    const cols = Array.isArray(phases) ? phases : [];
    if (showAll) {
      return cols
        .map((phase, i) => ({
          id: phase?.id ?? `${phase?.name ?? "phase"}-${i}`,
          name: phase?.name ?? "",
          tasks: Array.isArray(phase?.tasks) ? phase.tasks.filter(t => t && typeof t.content === "string") : [],
        }))
        .filter(p => p.tasks.length > 0);
    }
    let remaining = PREVIEW_TASKS;
    return cols.slice(0, PREVIEW_PHASES).map((phase, i) => {
      const ordered = [...(Array.isArray(phase?.tasks) ? phase.tasks : [])]
        .filter(t => t && typeof t.content === "string")
        .sort((a, b) => previewTaskOrder(a.status) - previewTaskOrder(b.status));
      const tasks = ordered.slice(0, Math.max(0, remaining));
      remaining -= tasks.length;
      return {
        id: phase?.id ?? `${phase?.name ?? "phase"}-${i}`,
        name: phase?.name ?? "",
        tasks,
      };
    }).filter(p => p.tasks.length > 0);
  }

  function isTruncated(phases, displayed) {
    const total = flatTasks(phases).length;
    const shown = (displayed || []).reduce((n, p) => n + (p.tasks?.length ?? 0), 0);
    return shown < total;
  }

  window.OMP_PLAN_PILL = {
    summary,
    previewPhases,
    isTruncated,
    PREVIEW_TASKS,
    PREVIEW_PHASES,
  };
})();
