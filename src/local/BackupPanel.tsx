import React, { useState } from "react";
import { localRequest, localSession } from "./runtime";
export default function BackupPanel({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  return (
    <div className="farm-backup-overlay">
      <section
        className="farm-backup-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Cloud backup"
      >
        <h2>Back up your local farm</h2>
        <p>
          Daily work stays on this computer. This action uploads a dated
          snapshot to your Firebase account. It does not merge with or overwrite
          your cloud plantations.
        </p>
        <p>
          Snapshots include farm records and public account details. Passwords
          and login sessions are excluded. Keep a full SQLite backup for
          complete server recovery.
        </p>
        <a href="/api/local/export">Download farm data</a>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget,
              data = new FormData(form);
            setBusy(true);
            setError("");
            setMessage("Preparing your farm snapshot…");
            try {
              const snapshot = await localRequest("export");
              const { uploadCloudBackup } = await import("./cloudBackup");
              const result = await uploadCloudBackup(
                snapshot,
                String(data.get("email")),
                String(data.get("password")),
              );
              form.reset();
              setMessage(
                `Backup complete. ${result.id} · ${result.documents} document records. Your local data remains unchanged.`,
              );
            } catch (e) {
              setMessage("");
              setError(
                e instanceof Error
                  ? e.message
                  : "Backup failed. Local data is unchanged.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Firebase account email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Firebase account password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <p>
            The cloud account can be different from your local username.
            Firebase backup rules must be deployed to your Firebase project
            before uploading.
          </p>
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={async (event) => {
              const form = event.currentTarget.form!;
              if (!form.reportValidity()) return;
              const data = new FormData(form);
              setBusy(true);
              setError("");
              setMessage(
                "Downloading and verifying the latest completed snapshot…",
              );
              try {
                const { uploadCloudBackup } = await import("./cloudBackup");
                const result = await uploadCloudBackup(
                  null,
                  String(data.get("email")),
                  String(data.get("password")),
                  localSession().farm.id,
                );
                const blob = new Blob([result.json!], {
                    type: "application/json",
                  }),
                  url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `agrimap-backup-${result.id}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                form.reset();
                setMessage(
                  "Verified backup downloaded. Restore it from the trusted server console; local records have not been changed.",
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : "Download failed");
                setMessage("");
              } finally {
                setBusy(false);
              }
            }}
          >
            Download latest cloud backup
          </button>
          <button type="submit" disabled={busy}>
            {busy ? "Uploading…" : "Back up to Firebase now"}
          </button>
          <button type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        </form>
      </section>
    </div>
  );
}
