import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Project } from "../../../types/project";

interface UseEditorAutosaveLifecycleOptions {
  project: Project | null;
  isDirty: boolean;
  saveProject: () => Promise<void>;
}

export function useEditorAutosaveLifecycle({
  project,
  isDirty,
  saveProject,
}: UseEditorAutosaveLifecycleOptions) {
  useEffect(() => {
    if (!isDirty || !project) return undefined;
    const timeout = window.setTimeout(() => {
      saveProject().catch(console.error);
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [isDirty, project, saveProject]);

  useEffect(() => {
    if (!project) return undefined;
    const intervalId = window.setInterval(() => {
      if (isDirty) {
        saveProject().catch(console.error);
      }
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [isDirty, project, saveProject]);

  useEffect(() => {
    const flushSave = () => {
      if (isDirty) {
        saveProject().catch(console.error);
      }
    };
    window.addEventListener("beforeunload", flushSave);
    return () => window.removeEventListener("beforeunload", flushSave);
  }, [isDirty, saveProject]);

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let closeInProgress = false;

    const unlistenClosePromise = currentWindow.onCloseRequested((event) => {
      if (!isDirty || closeInProgress) return;
      event.preventDefault();
      closeInProgress = true;
      saveProject()
        .catch(console.error)
        .finally(() => {
          currentWindow.close().catch(console.error);
        });
    });

    return () => {
      unlistenClosePromise.then((unlisten) => unlisten());
    };
  }, [isDirty, saveProject]);
}
