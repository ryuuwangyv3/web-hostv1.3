import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Layout, 
  FileCode, 
  Save, 
  Search, 
  Settings, 
  Menu, 
  X, 
  Terminal,
  Cpu,
  ShieldCheck,
  Zap,
  RefreshCcw,
  Code2,
  ExternalLink,
  Globe,
  RotateCw,
  Upload,
  FolderPlus,
  Plus,
  Github,
  Download,
  Home,
  Sparkles,
  GitBranch
} from "lucide-react";
import { cn } from "./lib/utils";
import { FileTree, type FileNode } from "./components/FileTree";
import { CodeEditor } from "./components/Editor";
import { InspectTab } from "./components/InspectTab";
import { GitTab } from "./components/GitTab";
import { SandboxModal } from "./components/SandboxModal";
import { ConsoleTab } from "./components/ConsoleTab";

import { Dashboard } from "./components/Dashboard";
import { ChatTab } from "./components/ChatTab";
import { SettingsTab } from "./components/SettingsTab";
import { useSettings } from "./contexts/SettingsContext";

export default function App() {
  const { settings } = useSettings();
  const [view, setView] = React.useState<"dashboard" | "editor">("dashboard");
  const [currentProject, setCurrentProject] = React.useState<{ name: string; path: string } | null>(null);
  const [files, setFiles] = React.useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [originalCode, setOriginalCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"editor" | "preview" | "chat" | "inspect" | "git" | "terminal" | "settings">("editor");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [previewKey, setPreviewKey] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState({ current: 0, total: 0, status: "" });
  const [showProgress, setShowProgress] = React.useState(false);
  const [githubModalOpen, setGithubModalOpen] = React.useState(false);
  const [extractModalOpen, setExtractModalOpen] = React.useState(false);
  const [sandboxOpen, setSandboxOpen] = React.useState(false);
  const [githubUrl, setGithubUrl] = React.useState("");
  const [extractUrl, setExtractUrl] = React.useState("");
  const [previewPath, setPreviewPath] = React.useState("/");
  const [errorLogs, setErrorLogs] = React.useState<string[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    try {
      const url = currentProject ? `/api/files?root=${encodeURIComponent(currentProject.path)}` : "/api/files";
      const res = await fetch(url);
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error("Failed to fetch files", err);
    }
  };

  const fetchFileContent = async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setCode(data.content);
      setOriginalCode(data.content);
      setSelectedFile(path);
    } catch (err) {
      console.error("Failed to fetch file content", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (contentToSave?: string) => {
    if (!selectedFile || saving) return;
    const finalContent = contentToSave !== undefined ? contentToSave : code;
    setSaving(true);
    try {
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedFile, content: finalContent }),
      });
      if (res.ok) {
        setOriginalCode(finalContent);
      }
    } catch (err) {
      console.error("Failed to save file", err);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save and Format-on-save logic
  React.useEffect(() => {
    if (!settings.autoSave || !selectedFile || code === originalCode) return;

    const timer = setTimeout(() => {
      let contentToSave = code;
      if (settings.formatOnSave) {
        // Simple formatting: trim trailing whitespace and ensure final newline
        contentToSave = code.split('\n').map(line => line.trimEnd()).join('\n');
        if (!contentToSave.endsWith('\n')) contentToSave += '\n';
        if (contentToSave !== code) {
          setCode(contentToSave);
        }
      }
      handleSave(contentToSave);
    }, 1500); // 1.5s debounce for auto-save

    return () => clearTimeout(timer);
  }, [code, settings.autoSave, settings.formatOnSave, selectedFile]);

  React.useEffect(() => {
    if (view === "editor") {
      fetchFiles();
    }

    const handleRefresh = () => fetchFiles();
    const handleClearLogs = () => setErrorLogs([]);
    const handleConsoleLog = (event: MessageEvent) => {
      if (event.data?.type === "AKASHA_CONSOLE_LOG") {
        const { logType, args } = event.data;
        if (logType === "error") {
          const errorMessage = args.map((arg: any) => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(" ");
          setErrorLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ERROR: ${errorMessage}`]);
        }
      }
    };

    window.addEventListener("AKASHA_REFRESH_FILES", handleRefresh);
    window.addEventListener("AKASHA_CLEAR_LOGS", handleClearLogs);
    window.addEventListener("message", handleConsoleLog);
    return () => {
      window.removeEventListener("AKASHA_REFRESH_FILES", handleRefresh);
      window.removeEventListener("AKASHA_CLEAR_LOGS", handleClearLogs);
      window.removeEventListener("message", handleConsoleLog);
    };
  }, [view, currentProject]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("path", currentProject ? currentProject.path : ""); 
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const extracted = data.files.filter((f: any) => f.extracted);
        const failed = data.files.filter((f: any) => f.error);
        
        if (extracted.length > 0) {
          console.log(`Extracted: ${extracted.map((f: any) => f.name).join(", ")}`);
        }
        
        if (failed.length > 0) {
          alert(`Failed to extract some files: ${failed.map((f: any) => f.name).join(", ")}`);
        }

        await fetchFiles();
      } else {
        const errorData = await res.json();
        alert(`Upload failed: ${errorData.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Upload failed. Check console for details.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length;
    setUploadProgress({ current: 0, total: totalFiles, status: "Initializing folder upload..." });
    setShowProgress(true);
    setUploading(true);
    const projectPrefix = currentProject ? currentProject.path + "/" : "";
    try {
      // Helper to sanitize paths from volume prefixes (e.g., "primary:folder" -> "folder")
      const sanitizePath = (p: string) => {
        if (!p) return "";
        let cleaned = p.replace(/%3A/gi, ":").replace(/%2F/gi, "/");
        cleaned = cleaned.replace(/\\/g, "/");
        const lastColonIndex = cleaned.lastIndexOf(":");
        if (lastColonIndex !== -1) {
          cleaned = cleaned.substring(lastColonIndex + 1);
        }
        cleaned = cleaned.replace(/^tree\//i, "");
        return cleaned.replace(/^\/+/, "");
      };

      // Group files by directory to minimize upload calls
      const filesByDir: Record<string, File[]> = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i] as any;
        const relativePath = sanitizePath(file.webkitRelativePath);
        const dirPath = relativePath.substring(0, relativePath.lastIndexOf("/"));
        const fullDirPath = projectPrefix + dirPath;
        if (!filesByDir[fullDirPath]) filesByDir[fullDirPath] = [];
        filesByDir[fullDirPath].push(file);
      }

      const totalDirs = Object.keys(filesByDir).length;
      let uploadedFiles = 0;
      let currentDirIndex = 0;

      for (const [dirPath, dirFiles] of Object.entries(filesByDir)) {
        currentDirIndex++;
        setUploadProgress(p => ({ 
          ...p, 
          status: `Uploading to ${dirPath.split('/').pop() || 'root'} (${currentDirIndex}/${totalDirs})` 
        }));

        const formData = new FormData();
        formData.append("path", dirPath);
        dirFiles.forEach(f => formData.append("files", f));
        
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error(`Failed to upload to ${dirPath}`);

        uploadedFiles += dirFiles.length;
        setUploadProgress(p => ({ ...p, current: uploadedFiles }));
      }

      setUploadProgress(p => ({ ...p, status: "Upload complete!" }));
      await fetchFiles();
      setTimeout(() => setShowProgress(false), 1000);
    } catch (err) {
      console.error("Folder upload failed", err);
      setUploadProgress(p => ({ ...p, status: "Upload failed!" }));
      setTimeout(() => setShowProgress(false), 3000);
    } finally {
      setUploading(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  };

  const handleDelete = async (path: string) => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedFile === path) {
          setSelectedFile(null);
          setCode("");
          setOriginalCode("");
        }
        await fetchFiles();
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleRename = async (oldPath: string, newName: string) => {
    const parentDir = oldPath.includes("/") ? oldPath.substring(0, oldPath.lastIndexOf("/")) : "";
    const newPath = parentDir ? `${parentDir}/${newName}` : newName;

    try {
      const res = await fetch("/api/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath }),
      });
      if (res.ok) {
        if (selectedFile === oldPath) {
          setSelectedFile(newPath);
        }
        await fetchFiles();
      }
    } catch (err) {
      console.error("Rename failed", err);
    }
  };

  const handleCreateFile = async (parentPath: string = "") => {
    const fileName = prompt("Enter new file name:");
    if (!fileName) return;

    let effectiveParent = parentPath;
    if (!effectiveParent && currentProject) {
      effectiveParent = currentProject.path;
    }

    const filePath = effectiveParent ? `${effectiveParent}/${fileName}` : fileName;
    try {
      const res = await fetch("/api/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content: "" }),
      });
      if (res.ok) {
        await fetchFiles();
        fetchFileContent(filePath);
      }
    } catch (err) {
      console.error("Create file failed", err);
    }
  };

  const handleCreateFolder = async (parentPath: string = "") => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName) return;

    let effectiveParent = parentPath;
    if (!effectiveParent && currentProject) {
      effectiveParent = currentProject.path;
    }

    const folderPath = effectiveParent ? `${effectiveParent}/${folderName}` : folderName;
    try {
      const res = await fetch("/api/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath }),
      });
      if (res.ok) {
        await fetchFiles();
      }
    } catch (err) {
      console.error("Create folder failed", err);
    }
  };

  const handleGithubImport = async () => {
    if (!githubUrl) return;
    setUploading(true);
    try {
      const res = await fetch("/api/import-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl, projectName: currentProject?.name }),
      });
      if (res.ok) {
        setGithubModalOpen(false);
        setGithubUrl("");
        await fetchFiles();
      } else {
        alert("Failed to import from GitHub. Make sure the repository is public.");
      }
    } catch (err) {
      console.error("GitHub import failed", err);
    } finally {
      setUploading(false);
    }
  };

  const handleExtractUrl = async () => {
    if (!extractUrl) return;
    setUploading(true);
    try {
      const res = await fetch("/api/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: extractUrl, projectPath: currentProject?.path }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchFiles();
        setExtractModalOpen(false);
        setExtractUrl("");
        if (data.fileName) {
          fetchFileContent(data.fileName);
          setPreviewPath("/" + data.fileName);
          setActiveTab("preview");
        }
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to extract URL");
      }
    } catch (err) {
      console.error("URL extraction failed", err);
      alert("Failed to extract URL. Check console for details.");
    } finally {
      setUploading(false);
    }
  };

  const handleExecuteCommand = async (command: string) => {
    // Log command to console
    window.postMessage({
      type: "AKASHA_CONSOLE_LOG",
      logType: "log",
      args: [`> AI Executing: ${command}`]
    }, "*");

    try {
      const res = await fetch("/api/shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, projectPath: currentProject?.path }),
      });
      const data = await res.json();
      
      // Log results to console
      if (data.stdout) {
        window.postMessage({
          type: "AKASHA_CONSOLE_LOG",
          logType: "log",
          args: [data.stdout]
        }, "*");
      }
      if (data.stderr) {
        window.postMessage({
          type: "AKASHA_CONSOLE_LOG",
          logType: "error",
          args: [data.stderr]
        }, "*");
      }
      if (data.error) {
        window.postMessage({
          type: "AKASHA_CONSOLE_LOG",
          logType: "error",
          args: [`Execution Error: ${data.error}`]
        }, "*");
      }

      window.postMessage({
        type: "AKASHA_CONSOLE_LOG",
        logType: "info",
        args: [`✓ Command finished: ${command}`]
      }, "*");
      
      // Refresh file tree in case files were created/deleted
      window.dispatchEvent(new CustomEvent("AKASHA_REFRESH_FILES"));
      
      return {
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        error: data.error || (data.validationFailed ? "Validation Failed" : undefined)
      };
    } catch (err: any) {
      window.postMessage({
        type: "AKASHA_CONSOLE_LOG",
        logType: "error",
        args: [`Fetch Error: ${err.message}`]
      }, "*");
      return { stdout: "", stderr: "", error: err.message };
    }
  };

  const handleAutoCreate = async (project: { projectName: string; files: { path: string; content?: string; action?: "add" | "modify" | "delete" }[] }) => {
    setLoading(true);
    try {
      let projectPath = currentProject?.path;

      // 1. Create project directory if it doesn't exist (only for new projects)
      if (!projectPath) {
        const createProjectRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: project.projectName }),
        });
        
        if (!createProjectRes.ok) throw new Error("Failed to create project directory");
        const projectData = await createProjectRes.json();
        projectPath = projectData.path;
      }

      // 2. Process all files based on action
      for (const file of project.files) {
        const fullPath = `${projectPath}/${file.path}`;
        const action = file.action || "modify"; // Default to modify/add if not specified

        if (action === "delete") {
          await fetch(`/api/file?path=${encodeURIComponent(fullPath)}`, {
            method: "DELETE",
          });
          continue;
        }

        const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
        
        // Ensure directory exists
        if (dirPath !== projectPath) {
          await fetch("/api/mkdir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: dirPath }),
          });
        }

        // Write file (add or modify)
        await fetch("/api/file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: fullPath, content: file.content || "" }),
        });
      }

      // 3. Update state and switch view
      if (!currentProject) {
        setCurrentProject({ name: project.projectName, path: projectPath });
        setPreviewPath("/" + projectPath + "/index.html");
      }
      
      await fetchFiles();
      setActiveTab("preview");
      setPreviewKey(prev => prev + 1); // Refresh preview to see changes
      
      // Select first file if exists and we are in editor view
      if (project.files.length > 0 && project.files[0].action !== "delete") {
        const firstFile = `${projectPath}/${project.files[0].path}`;
        fetchFileContent(firstFile);
      }
    } catch (err) {
      console.error("Project update/create failed", err);
      alert("Gagal memproses pembaruan proyek. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const isModified = code !== originalCode;

  const handleOpenProject = (project: { name: string; path: string } | null) => {
    setCurrentProject(project);
    setView(project ? "editor" : "dashboard");
    setSelectedFile(null);
    setCode("");
    setPreviewPath(project ? "/" + project.path + "/" : "/");
  };

  if (view === "dashboard") {
    return <Dashboard onOpenProject={handleOpenProject} />;
  }

  return (
    <div 
      className={cn(
        "flex h-[100dvh] w-full bg-[#050505] text-white overflow-hidden selection:bg-white/20",
        settings.theme === "midnight" && "bg-black",
        settings.theme === "cyberpunk" && "bg-[#0a001a] text-cyan-400",
        settings.theme === "minimal" && "bg-[#1a1a1a] text-gray-300"
      )}
      data-theme={settings.theme}
    >
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="fixed lg:relative w-64 h-full border-r border-white/5 flex flex-col bg-[#0a0a0a] z-50 shadow-2xl lg:shadow-none"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleOpenProject(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors mr-1"
                  title="Back to Dashboard"
                >
                  <Layout size={16} />
                </button>
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                  <Code2 size={16} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xs font-semibold tracking-tight">Akasha</h1>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest font-medium">
                    {currentProject ? currentProject.name : "IDE"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
              <div className="mb-6 space-y-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/50 transition-colors" size={14} />
                  <input 
                    type="text" 
                    placeholder="Search files..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-white/20 focus:bg-white/10 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button 
                    onClick={() => handleCreateFile()}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
                  >
                    <FileCode size={11} />
                    New File
                  </button>
                  <button 
                    onClick={() => handleCreateFolder()}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
                  >
                    <FolderPlus size={11} />
                    New Folder
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    <Upload size={11} />
                    Upload File
                  </button>
                  <button 
                    onClick={() => folderInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    <FolderPlus size={11} />
                    Upload Folder
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button 
                    onClick={() => setGithubModalOpen(true)}
                    disabled={uploading}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500/20 transition-all disabled:opacity-50"
                  >
                    <Github size={11} />
                    GitHub
                  </button>
                  <button 
                    onClick={() => setExtractModalOpen(true)}
                    disabled={uploading}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    <Globe size={11} />
                    Extract URL
                  </button>
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  multiple 
                  className="hidden" 
                />
                <input 
                  type="file" 
                  ref={folderInputRef} 
                  onChange={handleFolderUpload} 
                  {...{ webkitdirectory: "", directory: "" } as any} 
                  className="hidden" 
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Explorer</span>
                  <button onClick={fetchFiles} className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors">
                    <RefreshCcw size={12} />
                  </button>
                </div>
                <FileTree 
                  nodes={files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))} 
                  onFileSelect={fetchFileContent} 
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  selectedPath={selectedFile || undefined} 
                />
              </div>
            </div>

            <div className="p-4 border-t border-white/5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                  <ShieldCheck size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">System Secure</p>
                  <p className="text-[10px] text-white/40">Protocol Active</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-14 sm:h-12 border-b border-white/5 flex items-center justify-between px-3 sm:px-4 bg-[#050505]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors shrink-0"
              >
                <Menu size={18} />
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-white/60 min-w-0 truncate">
              <FileCode size={14} className="shrink-0" />
              <span className="font-mono truncate max-w-[150px] sm:max-w-none">
                {selectedFile || "Select a file"}
              </span>
              {isModified && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shrink-0" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-2">
            <button 
              onClick={() => window.open(window.location.origin + previewPath, '_blank')}
              className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 bg-white/5 border border-white/10 text-white rounded-lg text-[10px] sm:text-xs font-semibold hover:bg-white/10 transition-all active:scale-95"
              title="Open Preview in New Tab"
            >
              <ExternalLink size={14} />
              <span className="hidden md:inline">Open Preview</span>
            </button>
            {selectedFile?.endsWith(".html") && (
              <button 
                onClick={() => {
                  setPreviewPath("/" + selectedFile);
                  setActiveTab("preview");
                }}
                className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] sm:text-xs font-semibold hover:bg-emerald-500/20 transition-all active:scale-95"
              >
                <Globe size={14} />
                <span className="hidden md:inline">Preview File</span>
              </button>
            )}
            <button 
              onClick={() => handleSave()}
              disabled={!selectedFile || !isModified || saving}
              className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 bg-white text-black rounded-lg text-[10px] sm:text-xs font-semibold hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Save size={14} />
              <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </header>

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-white/5 bg-[#0a0a0a] overflow-x-auto scrollbar-none">
              <div className="flex min-w-max">
                {[
                  { id: "editor", icon: FileCode, label: "Source" },
                  { id: "preview", icon: Globe, label: "Preview" },
                  { id: "chat", icon: Sparkles, label: "AI Assistant" },
                  { id: "git", icon: GitBranch, label: "Git" },
                  { id: "inspect", icon: Cpu, label: "Inspect" },
                  { id: "terminal", icon: Terminal, label: "Console" },
                  { id: "settings", icon: Settings, label: "Settings" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium transition-all relative shrink-0",
                      activeTab === tab.id ? "text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    <tab.icon size={13} />
                    <span className="whitespace-nowrap">{tab.label}</span>
                    {activeTab === tab.id && (
                      <motion.div 
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-[#050505] z-10"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                      <p className="text-xs text-white/40 font-mono tracking-widest uppercase">Loading Source...</p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* Tab Contents - Kept mounted to prevent state loss/process interruption */}
              <div className={cn("h-full", activeTab !== "editor" && "hidden")}>
                {selectedFile ? (
                  <CodeEditor 
                    code={code} 
                    onChange={setCode} 
                    language={selectedFile.split(".").pop() || "typescript"} 
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 p-12 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center mb-6">
                      <Layout size={40} />
                    </div>
                    <h2 className="text-xl font-semibold text-white/40 mb-2">No File Selected</h2>
                    <p className="text-sm max-w-xs">Select a file from the explorer to start inspecting and editing the source code.</p>
                  </div>
                )}
              </div>

              <div className={cn("h-full", activeTab !== "chat" && "hidden")}>
                <ChatTab 
                  currentCode={code} 
                  fileName={selectedFile} 
                  fileTree={files}
                  errorLogs={errorLogs}
                  onApplyCode={(newCode) => {
                    setCode(newCode);
                    setActiveTab("editor");
                  }} 
                  onAutoCreate={handleAutoCreate}
                  onExecuteCommand={handleExecuteCommand}
                  projectPath={currentProject?.path}
                />
              </div>

              <div className={cn("h-full", activeTab !== "preview" && "hidden")}>
                <div className="h-full flex flex-col bg-white">
                  <div className="h-10 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                      </div>
                      <div className="h-6 px-3 bg-black/40 rounded-md flex items-center gap-2 min-w-[200px] border border-white/5">
                        <Globe size={10} className="text-white/40" />
                        <span className="text-[10px] text-white/40 font-mono truncate">{window.location.origin}{previewPath}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPreviewPath("/")}
                        className="p-1.5 hover:bg-white/10 rounded-md text-white/60 transition-colors"
                        title="Go to App Home"
                      >
                        <Home size={14} />
                      </button>
                      <button 
                        onClick={() => setPreviewKey(prev => prev + 1)}
                        className="p-1.5 hover:bg-white/10 rounded-md text-white/60 transition-colors"
                        title="Refresh Preview"
                      >
                        <RotateCw size={14} />
                      </button>
                      <button 
                        onClick={() => window.open(window.location.origin + previewPath, '_blank')}
                        className="p-1.5 hover:bg-white/10 rounded-md text-white/60 transition-colors"
                        title="Open in New Tab"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                  <iframe 
                    key={`${previewKey}-${previewPath}`}
                    src={previewPath} 
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      if (!iframe.contentWindow) return;
                      
                      const script = `
                        (function() {
                          const originalConsole = {
                            log: console.log,
                            error: console.error,
                            warn: console.warn,
                            info: console.info,
                          };
                          
                          const forwardLog = (type, ...args) => {
                            window.parent.postMessage({
                              type: "AKASHA_CONSOLE_LOG",
                              logType: type,
                              args: args.map(arg => {
                                try {
                                  return typeof arg === 'object' ? JSON.parse(JSON.stringify(arg)) : arg;
                                } catch (e) {
                                  return String(arg);
                                }
                              })
                            }, "*");
                          };
                          
                          console.log = (...args) => { originalConsole.log(...args); forwardLog("log", ...args); };
                          console.error = (...args) => { originalConsole.error(...args); forwardLog("error", ...args); };
                          console.warn = (...args) => { originalConsole.warn(...args); forwardLog("warn", ...args); };
                          console.info = (...args) => { originalConsole.info(...args); forwardLog("info", ...args); };
                        })();
                      `;
                      
                      try {
                        const scriptEl = iframe.contentDocument?.createElement('script');
                        if (scriptEl) {
                          scriptEl.textContent = script;
                          iframe.contentDocument?.head.appendChild(scriptEl);
                        }
                      } catch (err) {
                        console.warn("Could not inject console bridge into iframe (CORS or other issue)");
                      }
                    }}
                    className="flex-1 w-full border-none bg-white"
                    title="Web Preview"
                  />
                </div>
              </div>

              <div className={cn("h-full", activeTab !== "inspect" && "hidden")}>
                <InspectTab onLaunchSandbox={() => setSandboxOpen(true)} />
              </div>

              <div className={cn("h-full", activeTab !== "git" && "hidden")}>
                <GitTab currentProject={currentProject} />
              </div>

              <div className={cn("h-full", activeTab !== "settings" && "hidden")}>
                <SettingsTab />
              </div>

              <div className={cn("h-full", activeTab !== "terminal" && "hidden")}>
                <ConsoleTab projectPath={currentProject?.path} />
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <footer className="h-8 border-t border-white/5 bg-[#0a0a0a] flex items-center justify-between px-4 text-[10px] text-white/40 font-mono">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Connected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCcw size={10} />
              <span>Sync: Idle</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span>UTF-8</span>
            <span>TypeScript</span>
            <span>Line 1, Col 1</span>
          </div>
        </footer>
      </main>

      {/* GitHub Import Modal */}
      <AnimatePresence>
        {githubModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setGithubModalOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Github size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Import from GitHub</h3>
                  <p className="text-xs text-white/40">Enter a public repository URL to clone it</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-white/30 mb-1.5 ml-1">Repository URL</label>
                  <input 
                    type="text" 
                    placeholder="https://github.com/user/repo" 
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all text-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setGithubModalOpen(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white/50 hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleGithubImport}
                    disabled={!githubUrl || uploading}
                    className="flex-1 py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <RefreshCcw size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Download size={16} />
                        Import Project
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* URL Extraction Modal */}
      <AnimatePresence>
        {extractModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setExtractModalOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Extract from URL</h3>
                  <p className="text-xs text-white/40">Enter a website URL to extract its source code</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-bold text-white/30 mb-1.5 ml-1">Website URL</label>
                  <input 
                    type="text" 
                    placeholder="https://example.com" 
                    value={extractUrl}
                    onChange={(e) => setExtractUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all text-white"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setExtractModalOpen(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white/50 hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleExtractUrl}
                    disabled={!extractUrl || uploading}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <RefreshCcw size={16} className="animate-spin" />
                    ) : (
                      <>
                        <Download size={16} />
                        Extract Source
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SandboxModal 
        isOpen={sandboxOpen} 
        onClose={() => setSandboxOpen(false)} 
      />

      {/* Upload Progress Modal */}
      <AnimatePresence>
        {showProgress && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
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
                <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">{uploadProgress.status}</p>
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
      </AnimatePresence>
    </div>
  );
}
