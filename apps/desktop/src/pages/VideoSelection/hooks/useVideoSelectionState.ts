import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Project } from "../../../types/project";
import { useBatchExportQueue } from "./useBatchExportQueue";

export function useVideoSelectionState() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const batch = useBatchExportQueue({ selectedProjectIds, projects });

  const cameFromEditor = location.state?.from === "editor";
  const previousProjectId = location.state?.projectId;

  useEffect(() => {
    async function resizeWindow() {
      try {
        const window = getCurrentWindow();
        await window.setSize(new LogicalSize(1200, 800));
        await window.center();
      } catch (resizeError) {
        console.error("Failed to resize window:", resizeError);
      }
    }
    resizeWindow();
  }, []);

  useEffect(() => {
    void loadProjects();
  }, []);

  async function loadProjects() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Project[]>("list_projects");
      setProjects(result);
    } catch (loadError) {
      console.error("Failed to load projects:", loadError);
      setError(String(loadError));
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((previous) =>
      previous.includes(projectId)
        ? previous.filter((id) => id !== projectId)
        : [...previous, projectId]
    );
  }

  function handleSelectProject(project: Project) {
    if (selectionMode) {
      toggleProjectSelection(project.id);
      return;
    }
    navigate(`/editor/${project.id}`);
  }

  async function handleRenameProject(projectId: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) return;

    const target = projects.find((project) => project.id === projectId);
    if (!target || target.name === trimmed) return;

    const updatedProject = { ...target, name: trimmed };
    setProjects((prev) => prev.map((project) => (project.id === projectId ? updatedProject : project)));

    try {
      await invoke("save_project", { project: updatedProject });
    } catch (renameError) {
      console.error("Failed to rename project:", renameError);
      setProjects((prev) => prev.map((project) => (project.id === projectId ? target : project)));
    }
  }

  async function handleDeleteProject(projectId: string) {
    const target = projects.find((project) => project.id === projectId);
    if (!target) return;
    const confirmed = window.confirm(`Delete "${target.name}" and all its files?`);
    if (!confirmed) return;

    setProjects((prev) => prev.filter((project) => project.id !== projectId));
    setSelectedProjectIds((prev) => prev.filter((id) => id !== projectId));

    try {
      await invoke("delete_project", { projectId });
    } catch (deleteError) {
      console.error("Failed to delete project:", deleteError);
      setError(`Failed to delete project: ${String(deleteError)}`);
      await loadProjects();
    }
  }

  async function handleOpenProjectInNewWindow(projectId: string) {
    try {
      await invoke("open_project_window", { projectId });
    } catch (openError) {
      console.error("Failed to open project in new window:", openError);
      setError(`Failed to open project in new window: ${String(openError)}`);
    }
  }

  function handleBack() {
    if (cameFromEditor && previousProjectId) {
      navigate(`/editor/${previousProjectId}`);
    } else {
      navigate("/recorder");
    }
  }

  function handleGoToRecorder() {
    navigate("/recorder");
  }

  function toggleSelectionMode() {
    setSelectionMode((active) => {
      const next = !active;
      if (!next) {
        setSelectedProjectIds([]);
      }
      return next;
    });
  }

  return {
    projects,
    isLoading,
    error,
    selectionMode,
    selectedProjectIds,
    cameFromEditor,
    handleSelectProject,
    handleRenameProject,
    handleDeleteProject,
    handleOpenProjectInNewWindow,
    toggleProjectSelection,
    handleBack,
    handleGoToRecorder,
    toggleSelectionMode,
    ...batch,
  };
}
