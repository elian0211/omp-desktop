/* ═════════════════════════════════════════════════════════════════════
   app/process-details.js — fold a turn's tool/thinking activity into one
   "Process details" row (ompweb's chat-transcript-plan, adapted to the
   desktop's flattened transcript: tool cards are already separate
   messages, assistant replies carry thought + text blocks).

   docs/architecture/chat-collapse.md covers per-card collapse; this
   module is the turn-level fold. window.OMP_PROCESS_DETAILS.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  /** User prompt or compaction summary anchors a turn (ompweb isGroupAnchor). */
  function isAnchor(m) {
    return m && (m.kind === "user" || m.kind === "compact");
  }

  /** Ask / approval / live retry must stay clickable — never fold. */
  function isInteractive(m) {
    return m && (m.kind === "ask" || m.kind === "approval" || m.kind === "retry");
  }

  /** Assistant bubble that should stay outside the fold. */
  function hasVisibleReply(m) {
    if (!m || m.kind !== "assistant") return false;
    if (m.failure) return true;
    if (m.streaming) return true;
    const blocks = m.blocks;
    if (!Array.isArray(blocks)) return false;
    for (const b of blocks) {
      if (b && b.type === "text" && typeof b.text === "string" && b.text.trim()) return true;
    }
    return false;
  }

  /**
   * Message that folds into Process details when folding is on.
   * `showToolCalls`: tool cards stay as their own rows.
   * `showThinking`: thought-only assistant bubbles stay visible.
   */
  function isActivity(m, options = {}) {
    if (!m) return false;
    const hidden = typeof options.hidden === "function" ? options.hidden : null;
    if (hidden?.(m)) return false;
    if (isInteractive(m) || isAnchor(m)) return false;
    if (m.kind === "tool") return !options.showToolCalls;
    if (m.kind === "job" || m.kind === "goal") return true;
    if (m.kind === "assistant") {
      if (hasVisibleReply(m)) return false;
      // Thought-only (or empty) assistant between tools — activity unless
      // the user asked thinking to stay out of the fold.
      if (m.thought && options.showThinking) return false;
      return !!(m.thought);
    }
    return false;
  }

  /** Mid-run tail: a tool still running, or an assistant still streaming. */
  function looksLikeRunningTurn(messages, options = {}) {
    const hidden = typeof options.hidden === "function" ? options.hidden : null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m || hidden?.(m)) continue;
      if (m.kind === "tool" && (m.status === "pending" || m.status === "running")) return true;
      if (m.kind === "assistant" && m.streaming) return true;
      if (m.kind === "ask" || m.kind === "approval") return true;
      // A finished reply / settled tool ends the heuristic.
      return false;
    }
    return false;
  }

  /** Split one anchored turn into visible rows and folded activity runs. */
  function planTurnSegments(messages, userIdx, endIdx, options = {}) {
    const segments = [];
    let activity = null;
    const addActivity = (index, toolCalls) => {
      if (!activity) {
        activity = { kind: "activity", indices: [], stepCount: 0, toolCallCount: 0 };
        segments.push(activity);
      }
      activity.indices.push(index);
      activity.stepCount += 1;
      activity.toolCallCount += toolCalls;
    };

    const hidden = typeof options.hidden === "function" ? options.hidden : null;
    for (let idx = userIdx + 1; idx < endIdx; idx++) {
      const m = messages[idx];
      if (!m || hidden?.(m)) continue;
      if (isActivity(m, options)) {
        addActivity(idx, m.kind === "tool" ? 1 : 0);
        continue;
      }
      activity = null;
      segments.push({ kind: "visible", index: idx });
    }
    return segments;
  }

  /**
   * Plan the transcript into lightweight row descriptors (no React).
   * Options: neverFold, showToolCalls, showThinking, hidden(msg).
   */
  function planTranscriptRows(messages, options = {}) {
    const rows = [];
    const list = Array.isArray(messages) ? messages : [];
    const hidden = typeof options.hidden === "function" ? options.hidden : null;

    for (let idx = 0; idx < list.length;) {
      const m = list[idx];
      if (!m || hidden?.(m) || !isAnchor(m)) {
        if (m && !hidden?.(m)) rows.push({ kind: "message", index: idx });
        idx += 1;
        continue;
      }
      const userIdx = idx;
      let endIdx = userIdx + 1;
      while (endIdx < list.length && !isAnchor(list[endIdx])) endIdx += 1;

      if (options.neverFold) {
        for (let i = userIdx; i < endIdx; i++) {
          if (list[i] && !hidden?.(list[i])) rows.push({ kind: "message", index: i });
        }
        idx = endIdx;
        continue;
      }

      const segments = planTurnSegments(list, userIdx, endIdx, options);
      if (segments.some((s) => s.kind === "activity")) {
        rows.push({ kind: "group", userIndex: userIdx, endIndex: endIdx, segments });
      } else {
        for (let i = userIdx; i < endIdx; i++) {
          if (list[i] && !hidden?.(list[i])) rows.push({ kind: "message", index: i });
        }
      }
      idx = endIdx;
    }
    return rows;
  }

  /**
   * Whether a planned group should render flat (live tail). Default is to
   * fold even while working (`hideToolActivity`); set that false to keep
   * the running turn expanded.
   */
  function rendersFlat(row, messages, options = {}) {
    if (!row || row.kind !== "group") return false;
    if (options.hideToolActivity !== false) return false;
    if (row.endIndex !== messages.length) return false;
    // Last anchor in the transcript.
    for (let i = messages.length - 1; i > row.userIndex; i--) {
      if (isAnchor(messages[i])) return false;
    }
    return looksLikeRunningTurn(messages, options);
  }

  window.OMP_PROCESS_DETAILS = {
    isAnchor,
    isInteractive,
    hasVisibleReply,
    isActivity,
    looksLikeRunningTurn,
    planTurnSegments,
    planTranscriptRows,
    rendersFlat,
  };
})();
