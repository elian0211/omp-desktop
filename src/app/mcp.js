/* ═══════════════════════════════════════════════════════════════════════
   app/mcp.js — the pure side of Settings → MCP (window.OMP_MCP).

   The rows edit the profile's user `mcp.json` and show the open project's
   through Rust's `mcp_config_get` / `mcp_server_set` / `mcp_server_delete`
   (src-tauri mcp_config.rs). Rust redacts `env`/`headers` from every read
   and inherits the stored ones back into an edited server that omits
   them, so the frontend never handles secrets. This module holds the
   client-side mirror of Rust's validation (omp's loader rules), the
   transport type a server implies, and the blank server an "+ server"
   button starts from. IIFE per the project rule for plain <script> tags.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  const AUTH = Object.freeze({}); // reserved; MCP has no auth table today
  const TYPES = Object.freeze(["stdio", "http", "sse"]);

  /** The transport a server implies: its `type`, or http/sse from a url. */
  const typeOf = (server) => {
    if (!server || typeof server !== "object") return "stdio";
    if (server.type) return server.type;
    if (typeof server.url === "string" && server.url.trim()) return "http";
    return "stdio";
  };

  const validName = (name) =>
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name);

  /** The client-side mirror of mcp_config::validate_server. Returns "" or
   *  the first problem; Rust re-checks before writing. */
  const validate = (name, server) => {
    if (!validName(name)) return "Server name may contain letters, numbers, dots, dashes, and underscores (max 128).";
    if (!server || typeof server !== "object") return "Server configuration must be an object.";
    if (server.type != null && !TYPES.includes(server.type)) return "Server type must be stdio, http, or sse.";
    const hasCommand = typeof server.command === "string" && server.command.trim();
    const hasUrl = typeof server.url === "string" && server.url.trim();
    if (!!hasCommand === !!hasUrl) return "Provide exactly one of command or url.";
    const type = server.type ?? "stdio";
    if (type === "stdio" && !hasCommand) return "A stdio server requires a command.";
    if ((type === "http" || type === "sse") && !hasUrl) return "An HTTP or SSE server requires a URL.";
    if (hasUrl && !/^https?:\/\//.test(server.url.trim())) return "Server URL must be an http or https URL.";
    if (server.args != null && (!Array.isArray(server.args) || server.args.some(a => typeof a !== "string"))) {
      return "args must be an array of strings.";
    }
    if (server.timeout != null && (!Number.isInteger(server.timeout) || server.timeout < 0 || server.timeout > 600000)) {
      return "timeout must be an integer between 0 and 600000.";
    }
    return "";
  };

  /** What "+ server" starts from: a stdio command entry. */
  const blankServer = () => ({ type: "stdio", command: "", args: [] });

  /** Servers of a scope snapshot in file order, with the implied type. */
  const serversOf = (scope) => (scope?.servers ?? []).map(s => ({
    name: s.name,
    config: s.config ?? {},
    type: typeOf(s.config ?? {}),
    invalid: !!s.config?.invalid,
  }));

  /** Whether a scope snapshot lists `name` in omp's disabledServers. */
  const isDisabled = (scope, name) => (scope?.disabledServers ?? []).includes(name);

  window.OMP_MCP = { TYPES, typeOf, validName, validate, blankServer, serversOf, isDisabled };
})();
