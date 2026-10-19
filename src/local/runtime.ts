import {uiText} from '../i18n/runtime';
// Set only by the farm HTTP server before the application entry is loaded.
export const isLocalRuntime = Boolean((window as any).__AGRIMAP_LOCAL__);
export const localSession = () => (window as any).__AGRIMAP_LOCAL_SESSION__;
export async function localRequest(route: string, input?: object) {
  let response: Response;
  try {
    response = await fetch("/api/local/" + route, {
      credentials: "same-origin",
      cache: "no-store",
      ...(input
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        : {}),
    });
  } catch {
    const message =
      "Farm server unreachable. This save is not confirmed; reconnect and retry before leaving.";
    if (route === "documents/commit")
      window.dispatchEvent(
        new CustomEvent("agrimap-local-save-error", { detail: message }),
      );
    throw new Error(message);
  }
  const body = await response.json();
  if (!response.ok) {
    const error: any = new Error(uiText(body.error || "Farm server request failed"));
    error.status = response.status;
    if (response.status === 401)
      window.dispatchEvent(new Event("agrimap-local-session-expired"));
    if (route === "documents/commit")
      window.dispatchEvent(
        new CustomEvent("agrimap-local-save-error", { detail: error.message }),
      );
    throw error;
  }
  if (route === "documents/commit")
    window.dispatchEvent(new Event("agrimap-local-save-confirmed"));
  return body;
}
