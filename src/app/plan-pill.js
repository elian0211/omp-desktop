/* app/plan-pill.js — summary for the composer's plan pill (design/chat/
   plan-pill.jsx). Input is the design kanban shape live.js already builds
   from omp's todo phases (adapter.js buildKanban): columns with
   tasks[{ text, status: "pending" | "in_progress" | "done" }]. The pill
   shows one line — counts plus the task the agent is on — and clicking it
   opens the full plan kanban, so nothing here duplicates that panel.
   Dependency-free IIFE. */
(function () {
  function summary(kanban) {
    const cols = Array.isArray(kanban) ? kanban : [];
    const tasks = [];
    for (const col of cols) {
      if (!col || !Array.isArray(col.tasks)) continue;
      for (const task of col.tasks) {
        if (!task || typeof task.text !== "string") continue;
        tasks.push({ phase: col.title ?? "", text: task.text, status: task.status });
      }
    }
    if (tasks.length === 0) return null;
    const done  = tasks.filter(t => t.status === "done").length;
    const inProg = tasks.find(t => t.status === "in_progress") ?? null;
    // Task to display: the one in progress; with none (between phases or
    // right after the plan was written), the next pending one.
    const focus = inProg ?? tasks.find(t => t.status === "pending") ?? null;
    const phaseTitle = focus ? focus.phase : tasks[tasks.length - 1].phase;
    return {
      total:    tasks.length,
      done,
      allDone:  done === tasks.length,
      pct:      Math.round((done / tasks.length) * 100),
      current:  inProg ? inProg.text : null,
      next:     !inProg && focus ? focus.text : null,
      phaseTitle,
    };
  }

  window.OMP_PLAN_PILL = { summary };
})();
