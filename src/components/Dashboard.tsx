import React from "react";
import { 
  Plus, 
  Github, 
  Upload, 
  Folder, 
  Search, 
  Clock, 
  MoreVertical, 
  ExternalLink,
  Trash2,
  FolderPlus,
  RefreshCw,
  Download,
  Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface Project {
  name: string;
  path: string;
  lastModified?: string;
}

interface DashboardProps {
  onOpenProject: (project: Project | null) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenProject }) => {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [showGithubModal, setShowGithubModal] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState("");
  const [githubUrl, setGithubUrl] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState({ current: 0, total: 0, status: "" });
  const [showProgress, setShowProgress] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = React.useState<Project | null>(null);
  const [editName, setEditName] = React.useState("");
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const zipInputRef = React.useRef<HTMLInputElement>(null);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setActionLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewModal(false);
        setNewProjectName("");
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;
    
    setActionLoading(true);
    try {
      // Extract repo name for project name
      const repoName = githubUrl.split("/").pop()?.replace(".git", "") || "imported-repo";
      const res = await fetch("/api/import-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl, projectName: repoName }),
      });
      const data = await res.json();
      if (data.success) {
        setShowGithubModal(false);
        setGithubUrl("");
        fetchProjects();
      }
    } catch (err) {
      console.error("Failed to import from GitHub", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length;
    setUploadProgress({ current: 0, total: totalFiles, status: "Initializing upload..." });
    setShowProgress(true);
    setActionLoading(true);

    try {
      // Helper to sanitize paths from volume prefixes (e.g., "tree/document/primary:folder" -> "folder")
      const sanitizePath = (p: string) => {
        if (!p) return "";
        // Replace encoded colons and slashes for consistent processing
        let cleaned = p.replace(/%3A/gi, ":").replace(/%2F/gi, "/");
        // Handle backslashes
        cleaned = cleaned.replace(/\\/g, "/");
        
        // Look for the last colon which usually separates the volume/provider from the actual path
        const lastColonIndex = cleaned.lastIndexOf(":");
        if (lastColonIndex !== -1) {
          cleaned = cleaned.substring(lastColonIndex + 1);
        }
        
        // Remove common prefixes
        cleaned = cleaned.replace(/^tree\//i, "");
        
        // Remove leading slashes and return
        return cleaned.replace(/^\/+/, "");
      };

      // Get project name from the first folder in the path
      const firstFile = files[0] as any;
      const rawRelativePath = firstFile.webkitRelativePath;
      const sanitizedRelativePath = sanitizePath(rawRelativePath);
      
      // Extract the first part of the path as project name, and clean it
      let projectName = sanitizedRelativePath.split("/")[0] || "Untitled Project";
      projectName = projectName.replace(/[:%3A]/g, "").trim(); // Remove any stray colons
      
      const projectPrefix = `projects/${projectName}/`;

      // 1. Create root project directory
      setUploadProgress(p => ({ ...p, status: `Creating project: ${projectName}` }));
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName }),
      });

      // 2. Group files by directory to minimize upload calls
      const filesByDir: Record<string, File[]> = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as any;
        const relativePath = sanitizePath(file.webkitRelativePath);
        
        // If the path starts with the project name, we might want to keep it or strip it depending on how we structure
        // But here we want to upload to projects/projectName/subfolder
        // If relativePath is "manga/components/AudioLab.tsx" and projectName is "manga"
        // dirPath becomes "manga/components"
        const dirPath = relativePath.substring(0, relativePath.lastIndexOf("/"));
        
        // Ensure the path starts with the project name to avoid redundant nesting if the user selected the project folder itself
        let finalDirPath = dirPath;
        if (dirPath === projectName) {
          finalDirPath = projectName;
        } else if (dirPath.startsWith(projectName + "/")) {
          finalDirPath = dirPath;
        } else {
          // If it doesn't start with projectName, prepend it
          finalDirPath = dirPath ? `${projectName}/${dirPath}` : projectName;
        }

        const fullDirPath = `projects/${finalDirPath}`;
        
        if (!filesByDir[fullDirPath]) filesByDir[fullDirPath] = [];
        filesByDir[fullDirPath].push(file);
      }

      const totalDirs = Object.keys(filesByDir).length;
      let uploadedFiles = 0;
      let currentDirIndex = 0;

      // 3. Upload files directory by directory
      for (const [dir, dirFiles] of Object.entries(filesByDir)) {
        currentDirIndex++;
        setUploadProgress(p => ({ 
          ...p, 
          status: `Uploading to ${dir.split('/').pop() || 'root'} (${currentDirIndex}/${totalDirs})` 
        }));

        const formData = new FormData();
        formData.append("path", dir); // Path first for multer
        for (const file of dirFiles) {
          formData.append("files", file);
        }

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Failed to upload to ${dir}`);

        uploadedFiles += dirFiles.length;
        setUploadProgress(p => ({ ...p, current: uploadedFiles }));
      }

      setUploadProgress(p => ({ ...p, status: "Finishing up..." }));
      fetchProjects();
      
      // Small delay to show 100%
      setTimeout(() => setShowProgress(false), 1000);
    } catch (err) {
      console.error("Folder upload failed", err);
      setUploadProgress(p => ({ ...p, status: "Upload failed!" }));
      setTimeout(() => setShowProgress(false), 3000);
    } finally {
      setActionLoading(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".zip")) {
      alert("Please select a ZIP file.");
      return;
    }

    const projectName = file.name.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9-_]/g, "_");
    
    setUploadProgress({ current: 0, total: 1, status: `Extracting ${file.name}...` });
    setShowProgress(true);
    setActionLoading(true);

    try {
      // 1. Create project directory
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName }),
      });

      // 2. Upload and extract
      const formData = new FormData();
      formData.append("path", `projects/${projectName}`);
      formData.append("files", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      
      const data = await res.json();
      if (data.files[0]?.error) {
        throw new Error(data.files[0].error);
      }

      setUploadProgress({ current: 1, total: 1, status: "Extraction complete!" });
      fetchProjects();
      setTimeout(() => setShowProgress(false), 1000);
    } catch (err: any) {
      console.error("ZIP upload failed", err);
      alert(`ZIP upload failed: ${err.message}`);
      setShowProgress(false);
    } finally {
      setActionLoading(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  const handleCleanupPaths = async () => {
    if (!confirm("This will scan all projects and remove 'primary:' prefixes from folder and file names. Continue?")) return;
    
    setActionLoading(true);
    try {
      const res = await fetch("/api/cleanup-paths", { method: "POST" });
      if (res.ok) {
        alert("Cleanup successful! Refreshing projects...");
        fetchProjects();
      } else {
        alert("Cleanup failed.");
      }
    } catch (error) {
      console.error(error);
      alert("Error during cleanup.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(deletingProject.path)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeletingProject(null);
        fetchProjects();
      } else {
        alert("Failed to delete project.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting project.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim() || editName === editingProject.name) {
      setEditingProject(null);
      return;
    }

    setActionLoading(true);
    try {
      const newPath = `projects/${editName.trim()}`;
      const res = await fetch("/api/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath: editingProject.path, newPath }),
      });
      if (res.ok) {
        setEditingProject(null);
        fetchProjects();
      } else {
        alert("Failed to rename project.");
      }
    } catch (err) {
      console.error(err);
      alert("Error renaming project.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-[#050505] text-white font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Header */}
      <header className="h-14 sm:h-12 border-b border-white/5 bg-white/[0.02] backdrop-blur-xl flex items-center justify-between px-4 sm:px-8 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Folder className="text-white" size={16} />
          </div>
          <span className="font-bold tracking-tight text-base">Akasha Dashboard</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-500 transition-colors" size={12} />
            <input 
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/5 rounded-full py-1.5 pl-9 pr-4 text-xs outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all w-40 md:w-64"
            />
          </div>
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/10" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-10">
          {/* Hero Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-8">
          <button 
            onClick={() => setShowNewModal(true)}
            className="group relative overflow-hidden bg-indigo-600 hover:bg-indigo-500 p-3 sm:p-4 rounded-xl transition-all text-left shadow-xl shadow-indigo-500/10"
          >
            <div className="relative z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Plus size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-bold mb-0.5">New Project</h3>
              <p className="text-white/60 text-[9px] hidden sm:block">Create a fresh workspace</p>
            </div>
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all" />
          </button>

          <button 
            onClick={() => setShowGithubModal(true)}
            className="group relative overflow-hidden bg-white/5 hover:bg-white/[0.08] border border-white/5 p-3 sm:p-4 rounded-xl transition-all text-left"
          >
            <div className="relative z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/5 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Github size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-bold mb-0.5">GitHub</h3>
              <p className="text-white/40 text-[9px] hidden sm:block">Clone a repository</p>
            </div>
          </button>

          <button 
            onClick={() => folderInputRef.current?.click()}
            className="group relative overflow-hidden bg-white/5 hover:bg-white/[0.08] border border-white/5 p-3 sm:p-4 rounded-xl transition-all text-left"
          >
            <div className="relative z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/5 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Upload size={16} />
              </div>
              <h3 className="text-sm sm:text-base font-bold mb-0.5">Folder</h3>
              <p className="text-white/40 text-[9px] hidden sm:block">Import project folder</p>
            </div>
            <input 
              type="file" 
              ref={folderInputRef} 
              onChange={handleFolderUpload} 
              {...{ webkitdirectory: "", directory: "" } as any} 
              className="hidden" 
            />
          </button>

          <button 
            onClick={() => zipInputRef.current?.click()}
            className="group relative overflow-hidden bg-white/5 hover:bg-white/[0.08] border border-white/5 p-3 sm:p-4 rounded-xl transition-all text-left"
          >
            <div className="relative z-10">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/5 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Download size={16} className="rotate-180" />
              </div>
              <h3 className="text-sm sm:text-base font-bold mb-0.5">ZIP</h3>
              <p className="text-white/40 text-[9px] hidden sm:block">Auto-extract ZIP</p>
            </div>
            <input 
              type="file" 
              ref={zipInputRef} 
              onChange={handleZipUpload} 
              accept=".zip"
              className="hidden" 
            />
          </button>
        </div>

        {/* Projects List */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
              Recent Projects
              <span className="text-[10px] font-normal text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full">{projects.length}</span>
            </h2>
            <div className="flex items-center justify-between sm:justify-end gap-1.5 text-[10px] text-white/40">
              <button 
                onClick={handleCleanupPaths}
                className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md transition-colors text-indigo-400"
                title="Fix folder/file names with 'primary:' prefix"
              >
                <RefreshCw size={10} />
                <span>Fix Paths</span>
              </button>
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span>Updated: Just now</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredProjects.map((project) => (
                  <motion.div
                    layout
                    key={project.path}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group bg-white/5 hover:bg-white/[0.08] border border-white/5 hover:border-white/10 p-3 rounded-xl transition-all cursor-pointer relative"
                    onClick={() => onOpenProject(project)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-7 h-7 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                        <Folder size={14} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditName(project.name);
                            setEditingProject(project);
                          }}
                          className="p-1 hover:bg-white/10 rounded-lg text-white/20 hover:text-indigo-400 transition-colors"
                          title="Rename Project"
                        >
                          <Pencil size={12} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingProject(project);
                          }}
                          className="p-1 hover:bg-white/10 rounded-lg text-white/20 hover:text-red-400 transition-colors"
                          title="Delete Project"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="text-sm font-bold mb-0.5 group-hover:text-indigo-400 transition-colors">{project.name}</h4>
                    <p className="text-white/40 text-[9px] mb-2 flex items-center gap-1.5">
                      <Clock size={10} />
                      Updated 2 hours ago
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[8px] uppercase tracking-widest text-white/20 font-bold">TypeScript Project</span>
                      <ExternalLink size={10} className="text-white/20 group-hover:text-white transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 bg-white/[0.02] border border-dashed border-white/5 rounded-3xl">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-white/20">
                <FolderPlus size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">No projects found</h3>
              <p className="text-white/40 text-sm mb-6">Start by creating a new project or importing one</p>
              <button 
                onClick={() => setShowNewModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-full font-bold transition-all"
              >
                Create First Project
              </button>
            </div>
          )}
        </div>
      </div>
    </main>

      {/* Modals */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6">Create New Project</h2>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">Project Name</label>
                  <input 
                    autoFocus
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="my-awesome-app"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading || !newProjectName.trim()}
                    className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {actionLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Create Project"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showGithubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGithubModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <Github className="text-indigo-500" size={24} />
                <h2 className="text-2xl font-bold">Import from GitHub</h2>
              </div>
              <form onSubmit={handleImportGithub} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">Repository URL</label>
                  <input 
                    autoFocus
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowGithubModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading || !githubUrl.trim()}
                    className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {actionLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Import Repo"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showProgress && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
                <Upload size={32} className="animate-bounce" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Uploading Folder</h3>
                <p className="text-sm text-white/40">{uploadProgress.status}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/20">
                  <span>Progress</span>
                  <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                    className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                  />
                </div>
                <p className="text-[10px] text-white/20">
                  {uploadProgress.current} of {uploadProgress.total} files processed
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProject(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6">Rename Project</h2>
              <form onSubmit={handleRenameProject} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">New Name</label>
                  <input 
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingProject(null)}
                    className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={actionLoading || !editName.trim() || editName === editingProject.name}
                    className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {actionLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Rename"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {deletingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingProject(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-500 mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Delete Project?</h2>
              <p className="text-white/40 text-sm mb-8">
                Are you sure you want to delete <span className="text-white font-bold">"{deletingProject.name}"</span>? 
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setDeletingProject(null)}
                  className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteProject}
                  disabled={actionLoading}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {actionLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Delete Forever"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
