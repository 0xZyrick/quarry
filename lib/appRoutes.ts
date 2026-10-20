export type AppRoute =
  | { kind: "studio" }
  | { kind: "discover" }
  | { kind: "room"; id: string }
  | { kind: "project"; id: string }
  | { kind: "profile"; handle: string };

function segment(value: string) {
  return encodeURIComponent(value.trim());
}

export function pathForRoute(route: AppRoute): string {
  switch (route.kind) {
    case "studio":
      return "/studio";
    case "discover":
      return "/discover";
    case "room":
      return `/room/${segment(route.id)}`;
    case "project":
      return `/project/${segment(route.id)}`;
    case "profile":
      return `/u/${segment(route.handle.replace(/^@/, ""))}`;
  }
}

function decodeSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Public default is Discover — proof of work without auth. */
export function routeFromPath(pathname: string): AppRoute {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "discover" };
  if (parts[0] === "discover") return { kind: "discover" };
  if (parts[0] === "studio") return { kind: "studio" };
  if (parts[0] === "room") {
    return {
      kind: "room",
      id: parts[1] ? decodeSegment(parts[1]) || "n0" : "n0",
    };
  }
  if (parts[0] === "project" && parts[1]) {
    return { kind: "project", id: decodeSegment(parts[1]) || "" };
  }
  if ((parts[0] === "u" && parts[1]) || parts.length === 1) {
    const value = decodeSegment(parts[0] === "u" ? parts[1] : parts[0]);
    if (value) return { kind: "profile", handle: value.replace(/^@/, "") };
  }
  return { kind: "discover" };
}

export function navigateToRoute(route: AppRoute, replace = false) {
  if (typeof window === "undefined") return;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ wippoRoute: true }, "", pathForRoute(route));
  window.dispatchEvent(new Event("wippo:routechange"));
}

export function returnFromRoute(fallback: AppRoute = { kind: "discover" }) {
  if (typeof window === "undefined") return;
  if (window.history.state?.wippoRoute && window.history.length > 1) {
    window.history.back();
    return;
  }
  navigateToRoute(fallback, true);
}
