/* tab-run-dot.jsx — a tab's (or project's) run-state dot; nothing while
   idle. Shared by the thin session tab strip, the project strip and the
   project side's Sessions fold so the titles stay in one place.
   (The project chip this file grew out of retired with the project strip
   — project-dock-layout decisions 8/11.) */

function TabRunDot({ state }) {
  if (!state || state === "idle") return null;
  const title = state === "waiting-user" ? "waiting for you"
    : state === "failed" ? "agent process exited"
    : state === "background" ? "background job running · the agent resumes when it finishes"
    : state === "retrying" ? "retrying a failed request"
    : "running";
  return <span className={`tab-run-dot ${state}`} title={title} />;
}

Object.assign(window, { TabRunDot });
