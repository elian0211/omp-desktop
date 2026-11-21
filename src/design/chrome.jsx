/* ═════════════════════════════════════════════════════════════════════
   chrome.jsx — window chrome, tabs, status bar, ambient peripherals
   - WindowChrome (traffic lights, title)
   - TabBar
   - StatusBar
   - Ambient rail: TokenGauge, ActivityRadar, subagents card, Minimap
   ═════════════════════════════════════════════════════════════════════ */

const { Icon, TokenGauge, ActivityRadar, Sparkline, TOOL_META, TabRunDot, BranchMenu } = window;
const { membersNewestFirst } = window.OMP_PROJECT_NAV;

// Thin wrappers around the shared `OMP_KEYMAP.hintFor`/`hintKeyFor` — same
// guard and rationale as composer.jsx's copy (kept local rather than a
// third file to import from; see composer.jsx's doc comment for why the
// registry-not-loaded fallback can't move into keymap.js itself).
function hintFor(actionId, fallback) {
  return window.OMP_KEYMAP ? window.OMP_KEYMAP.hintFor(actionId) : fallback;
}

// ── Platform detection ────────────────────────────────────────────────
const IS_WIN = typeof navigator !== "undefined" &&
  (navigator.userAgent.includes("Windows") || navigator.platform.startsWith("Win"));

// ── Window chrome ─────────────────────────────────────────────────────
// Title and window controls only: the bridge and the profile menu are on
// the toolbar (toolbar.jsx).
function WindowChrome({ project }) {
  return (
    <div className="chrome" data-tauri-drag-region>
      {/* macOS traffic lights — left side, hidden on Windows */}
      {!IS_WIN && (
        <div className="chrome-lights">
          <span className="light red" />
          <span className="light amber" />
          <span className="light green" />
        </div>
      )}

      <div className="chrome-title">
        {/* No tab: EMPTY_PROJECT's name is the app's own, so no "OMP ·" prefix. */}
        {project.id && <>
          <span className="mono" style={{ color: "var(--fg-3)" }}>OMP</span>
          <span className="mono" style={{ color: "var(--fg-5)" }}>·</span>
        </>}
        <span style={{ color: "var(--fg-2)" }}>{project.name}</span>
      </div>

      <div className="chrome-right">
        {/* Windows controls — right side, hidden on macOS/Linux */}
        {IS_WIN && (
          <div className="win-controls">
            <button className="win-ctrl win-min" title={OMP_TR("Minimize")}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 5.5h8" stroke="currentColor" strokeWidth="1" /></svg>
            </button>
            <button className="win-ctrl win-max" title={OMP_TR("Maximize / Restore")}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
            </button>
            <button className="win-ctrl win-close" title={OMP_TR("Close")}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.1" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Project tabs ─────────────────────────────────────────────────────
// A tab's click props: select on click, close on middle-click, as in
// browsers (#24). WebKit before Safari 18.2 / WebKitGTK 2.46 has no
// `auxclick` and reports it as a `click` with button 1, hence the check in
// onClick too; newer engines never send `click` for button 1, so this
// can't double-fire. Swallowing the middle-button mousedown stops Windows
// autoscroll and Linux primary-selection paste from firing on the tab.
function tabClickProps(onSelect, onClose) {
  return {
    onClick: e => (e.button === 1 ? onClose?.() : onSelect?.()),
    onMouseDown: e => { if (e.button === 1) e.preventDefault(); },
    onAuxClick: e => { if (e.button === 1) { e.preventDefault(); onClose?.(); } },
  };
}

/** Thin session tabs for the active project only (project-dock-layout).
   `group` is one `groupTabs` entry or null; Settings stays pinned after. */
function TabBar({
  group, activeId, onSelect, onClose, onReorder,
  settings, onSelectSettings, onCloseSettings,
}) {
  const reorder = window.useDragReorder(onReorder);
  const members = group ? `members:${group.key}` : null;
  const rows = group ? membersNewestFirst(group) : [];
  return (
    <div className="session-tabs" onPointerDown={group ? reorder.onPointerDown : undefined}
      role="tablist" aria-label={OMP_TR("open tabs")}>
      {rows.map(t => (
        <div key={t.id}
          {...(members ? reorder.itemProps(members, t.id, "x") : {})}
          className={`tab ${t.id === activeId ? "active" : ""}${members ? reorder.dropClass(members, t.id) : ""}`}
          title={t.name}
          {...tabClickProps(() => onSelect(t.id), () => onClose(t.id))}>
          <TabRunDot state={t.runState} />
          <span className="tab-name">{t.name}</span>
          <button className="tab-close" title={`${OMP_TR("close")} (${hintFor("desktop.tab.close", "Ctrl+W")})`}
            onClick={e => { e.stopPropagation(); onClose(t.id); }}>
            <Icon name="close" size={9} />
          </button>
        </div>
      ))}
      {settings?.open && (
        <div className={`tab app-tab ${settings.active ? "active" : ""}`}
          title={`${OMP_TR("settings")} (${hintFor("desktop.settings.open", "Ctrl+,")})`}
          {...tabClickProps(onSelectSettings, onCloseSettings)}>
          <Icon name="cog" size={12} />
          <span className="tab-name">{OMP_TR("Settings")}</span>
          {settings.changed > 0 && (
            <span className="tab-count" title={OMP_TR("{n} changed from default", { n: settings.changed })}>{settings.changed}</span>
          )}
          <button className="tab-close" title={`${OMP_TR("close")} (${hintFor("desktop.tab.close", "Ctrl+W")})`}
            onClick={e => { e.stopPropagation(); onCloseSettings?.(); }}>
            <Icon name="close" size={9} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Status bar (footer) ──────────────────────────────────────────────
// Connection, the project's branch (a picker, design/branch-menu.jsx),
// tokens, cost, throughput and todo on the left, the app version (and an
// available update) on the right; the app's other buttons are on the
// toolbar (toolbar.jsx). The model and
// thinking level are not repeated here: the composer's pills below the
// prompt box show (and change) both. It spans the window under the
// workspace; the st-ctx meter, st-cost and st-tps cells (each with its
// separator) drop out when the window is narrow (layout/rail.css).
// `updater`: app/use-updater.jsx's result, as UpdateModal takes it.
// `branch`: the active tab's (null: no repository, or a detached HEAD);
// `tabId` keys the picker, so a tab switch closes it; `branchLocked`: an
// agent works on the folder, so the picker lists but does not switch.
function StatusBar({ ctx, todoDone, todoTotal, onTodo, updater, branch, tabId, branchLocked, bridge }) {
  const todoChord = hintFor("desktop.panel.todo", "");
  return (
    <div className="status">
      <span className="status-cell"><span className="dot live" /> {OMP_TR("connected")}</span>
      {branch && <>
        <span className="status-sep">·</span>
        <BranchMenu key={tabId} branch={branch} bridge={bridge} locked={branchLocked} />
      </>}
      <span className="status-sep">·</span>
      <span className="status-cell st-ctx mono">
        <span style={{ color: "var(--fg-3)" }}>{ctx.label}</span>
        <span className="status-bar-tube">
          <span className="status-bar-fill" style={{ width: `${ctx.pct}%` }} />
        </span>
        <span className="st-ctx-pct" style={{ color: "var(--fg-4)" }}>{(+ctx.pct).toFixed(1)}%</span>
      </span>
      <span className="status-sep st-cost">·</span>
      <span className="status-cell st-cost mono"><span style={{ color: "var(--fg-3)" }}>{OMP_TR("cost")}</span> {ctx.cost}</span>
      <span className="status-sep st-tps">·</span>
      <span className="status-cell st-tps mono"><span style={{ color: "var(--fg-3)" }}>{ctx.tokensPerSec}</span> t/s</span>
      <span className="status-sep">·</span>
      <button className="status-cell btn ghost" onClick={onTodo}
        title={todoChord ? `${OMP_TR("tasks")} (${todoChord})` : OMP_TR("tasks")}
        style={{ height: 20, padding: "0 6px" }}>
        <Icon name="plan" size={11} color="var(--accent)" />
        <span style={{ color: "var(--accent)" }}>{OMP_TR("todo")} {todoDone}/{todoTotal}</span>
      </button>
      <div className="status-gap" />
      {updater.pillVersion && (
        <button className="btn outlined update-pill mono" onClick={updater.openModal}
          title={OMP_TR("OMP Desktop v{v} is available", { v: updater.pillVersion })}>
          <Icon name="arrowUp" size={9} />v{updater.pillVersion}
        </button>
      )}
      <button className="btn ghost app-version mono" onClick={updater.check} title={OMP_TR("check for updates")}>
        {updater.version ? `v${updater.version}` : "—"}
      </button>
    </div>
  );
}

// ── Minimap of the session: dense grid, one cell per message ─────────
// Hue encodes role/tool color (same palette as the chat). For assistant
// messages, opacity is log-scaled by tokens used so expensive turns pop
// against cheap ones. Click scrolls the chat to that message; hover
// highlights it via shared hoveredIdx state.
function SessionMinimap({ messages, hoveredIdx, onHover, onClick }) {
  // Log-scaled max across assistant messages so heatmap variance is
  // visible even when one compaction turn dwarfs the rest.
  const { maxTokens, shown } = React.useMemo(() => {
    let max = 0;
    let n = 0;
    for (const m of messages) {
      if (window.OMP_TURN_STATUS.isHidden(m)) continue; // the chat hides it too
      n++;
      if (m.kind === "assistant" && m.tokens && m.tokens > max) max = m.tokens;
    }
    return { maxTokens: max, shown: n };
  }, [messages]);
  const logMax = Math.log10(maxTokens + 1) || 1;

  return (
    <div className="minimap">
      <div className="minimap-head">
        <Icon name="minimap" size={11} color="var(--fg-3)" />
        <span className="mono" style={{ color: "var(--fg-3)" }}>{OMP_TR("session")}</span>
        <span className="mono" style={{ marginLeft: "auto", color: "var(--fg-4)" }}>{shown}</span>
      </div>
      <div className="minimap-grid">
        {messages.map((m, i) => {
          if (window.OMP_TURN_STATUS.isHidden(m)) return null;
          let hue = "var(--fg-5)";
          if      (m.kind === "user")      hue = "var(--fg-3)";
          else if (m.kind === "assistant") hue = m.failure ? "var(--rose)" : "var(--accent)";
          else if (m.kind === "ask")       hue = "var(--amber)";
          else if (m.kind === "retry")     hue = TOOL_META.retry.color;
          else if (m.kind === "tool")      hue = TOOL_META[m.tool]?.color || "var(--fg-4)";
          else if (m.kind === "job")       hue = TOOL_META.job.color;
          else if (m.kind === "goal")      hue = TOOL_META.goal.color;
          else if (m.kind === "approval")  hue = TOOL_META.approval.color;

          // Brightness: assistant cells modulate by log(tokens), others flat.
          let opacity = 0.7;
          if (m.kind === "assistant" && m.tokens && maxTokens > 0) {
            const t = Math.log10(m.tokens + 1) / logMax;
            opacity = 0.4 + 0.6 * Math.max(0, Math.min(1, t));
          }

          // Per-kind tooltip — tools don't carry their own tokens (the
          // LLM cost lives on the assistant message that invoked them),
          // so they get tool-specific info instead of a token chip.
          let title;
          if (m.kind === "assistant" && m.failure) {
            title = `request failed${m.failure.httpStatus != null ? ` · HTTP ${m.failure.httpStatus}` : ""}${m.time ? " · " + m.time : ""}`;
          } else if (m.kind === "assistant") {
            const tok  = m.tokens ? `${m.tokens.toLocaleString()} tok` : "—";
            const inOut = (m.tokensIn != null || m.tokensOut != null)
              ? ` (${(m.tokensIn ?? 0).toLocaleString()} in · ${(m.tokensOut ?? 0).toLocaleString()} out)`
              : "";
            title = `assistant · ${tok}${inOut}${m.time ? " · " + m.time : ""}`;
          } else if (m.kind === "tool") {
            const dur = m.duration ? ` · ${(m.duration / 1000).toFixed(1)}s` : "";
            const status = m.status === "running" ? " · running" : (m.status === "ok" ? "" : ` · ${m.status}`);
            title = `${m.tool ?? "tool"}${m.title ? " " + m.title : ""}${dur}${status}`;
          } else if (m.kind === "user") {
            const preview = m.text ? ` · ${m.text.slice(0, 80)}${m.text.length > 80 ? "…" : ""}` : "";
            title = `you${preview}`;
          } else if (m.kind === "job") {
            title = `${m.jobId} finished${m.label ? " · " + m.label : ""}`;
          } else if (m.kind === "retry") {
            title = `retrying · attempt ${m.attempt}${m.maxAttempts ? " of " + m.maxAttempts : ""}`;
          } else if (m.kind === "goal") {
            title = window.OMP_GOAL.rowView(m).title;
          } else if (m.kind === "approval") {
            title = `auto-approved · ${m.tool || "tool"}`;
          } else {
            title = m.kind;
          }
          const cls = `minimap-cell ${m.kind} ${m.streaming ? "live" : ""} ${hoveredIdx === i ? "hot" : ""}`.trim();

          return (
            <div key={m._id ?? i}
              className={cls}
              style={{ background: hue, opacity }}
              title={title}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => onClick?.(i)} />
          );
        })}
      </div>
      <div className="minimap-legend">
        <span className="minimap-legend-item"><i style={{ background: "var(--fg-3)" }} />{OMP_TR("you")}</span>
        <span className="minimap-legend-item"><i style={{ background: "var(--accent)" }} />{OMP_TR("assistant")}</span>
        <span className="minimap-legend-item"><i style={{ background: "var(--amber)" }} />{OMP_TR("ask")}</span>
        <span className="minimap-legend-item"><i style={{ background: "var(--fg-4)" }} />{OMP_TR("tool")}</span>
      </div>
    </div>
  );
}

// ── Rail cards, shared with the Session activity view ────────────────
// Context (token gauge + throughput sparkline).
function ContextCard({ ctx, sparkValues }) {
  const sparkVals = (sparkValues && sparkValues.length > 0)
    ? sparkValues
    : Array(30).fill(0);
  return (
    <div className="rail-card glass">
      <TokenGauge used={ctx.used} total={ctx.total} pct={ctx.pct}
        label={ctx.label} sub={`${OMP_TR("cost")} ${ctx.cost} · ${ctx.tokensPerSec} t/s`} />
      <div className="rail-spark">
        <Sparkline values={sparkVals} width={210} height={28} />
        <div className="rail-spark-foot mono">
          <span style={{ color: "var(--fg-4)" }}>{OMP_TR("throughput")}</span>
          <span style={{ color: "var(--accent)" }}>{ctx.tokensPerSec} t/s</span>
        </div>
      </div>
    </div>
  );
}

// Agent radar (last 60s of tool activity). `flat` omits the card head —
// the Session view's accordion supplies the title.
function RadarCard({ activity, tps, flat = false }) {
  return (
    <div className="rail-card glass">
      {!flat && (
        <div className="rail-card-head">
          <Icon name="radar" size={11} color="var(--accent)" />
          <span className="mono" style={{ color: "var(--fg-2)" }}>{OMP_TR("agent radar")}</span>
          <span className="chip muted mono" style={{ marginLeft: "auto" }}>{OMP_TR("last 60s")}</span>
        </div>
      )}
      <ActivityRadar activity={activity} tps={tps} />
      <div className="legend">
        {Object.entries(TOOL_META).filter(([k]) => ["read","search","edit","bash"].includes(k)).map(([k, m]) => (
          <span key={k} className="legend-item">
            <span style={{ background: m.color }} /> {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Session minimap. `grow` stretches the card (the rail's filler); the
// side view sizes it by content instead.
function MinimapCard({ messages, hoveredIdx, onHover, onClick, grow = false, flat = false }) {
  return (
    <div className="rail-card glass" style={grow ? { flex: 1, display: "flex", flexDirection: "column", minHeight: 120 } : undefined}>
      {!flat && (
        <div className="rail-card-head">
          <Icon name="minimap" size={11} color="var(--fg-3)" />
          <span className="mono" style={{ color: "var(--fg-2)" }}>{OMP_TR("minimap")}</span>
        </div>
      )}
      <SessionMinimap messages={messages} hoveredIdx={hoveredIdx} onHover={onHover} onClick={onClick} />
    </div>
  );
}

// ── Right rail (phase 3 of the workspace layout): widget plugin cards
// only — the per-tab ambient cards live in the Session activity view. The
// rail renders no chrome of its own; app-live mounts it only when there is
// widget UI. The shared card bodies above (ContextCard, RadarCard,
// MinimapCard) stay exported for design/side-views/session-view.jsx.

Object.assign(window, { WindowChrome, TabBar, StatusBar, SessionMinimap, ContextCard, RadarCard, MinimapCard });
