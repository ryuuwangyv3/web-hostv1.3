import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  GitBranch, 
  GitCommit, 
  GitMerge, 
  History, 
  Plus, 
  RefreshCw, 
  Check, 
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Clock,
  User,
  MessageSquare,
  FileText,
  Trash2
} from "lucide-react";
import { cn } from "../lib/utils";

interface GitStatus {
  filepath: string;
  head: number;
  workdir: number;
  stage: number;
}

interface GitLog {
  oid: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      timestamp: number;
    };
  };
}

interface GitTabProps {
  currentProject: { name: string; path: string } | null;
}

export function GitTab({ currentProject }: GitTabProps) {
  const [status, setStatus] = React.useState<GitStatus[]>([]);
  const [log, setLog] = React.useState<GitLog[]>([]);
  const [branches, setBranches] = React.useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [commitMessage, setCommitMessage] = React.useState("");
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchGitData = async () => {
    if (!currentProject) return;
    setLoading(true);
    setError(null);
    try {
      const projectPath = currentProject.path;
      
      // Check if initialized by trying to get status
      const statusRes = await fetch(`/api/git/status?projectPath=${encodeURIComponent(projectPath)}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
        setIsInitialized(true);

        // Fetch log
        const logRes = await fetch(`/api/git/log?projectPath=${encodeURIComponent(projectPath)}`);
        if (logRes.ok) setLog(await logRes.json());

        // Fetch branches
        const branchesRes = await fetch(`/api/git/branches?projectPath=${encodeURIComponent(projectPath)}`);
        if (branchesRes.ok) {
          const data = await branchesRes.json();
          setBranches(data.branches);
          setCurrentBranch(data.currentBranch);
        }
      } else {
        setIsInitialized(false);
      }
    } catch (err) {
      console.error("Git fetch failed", err);
      setError("Failed to fetch Git data. Is this a Git repository?");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchGitData();
  }, [currentProject]);

  const handleInit = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await fetch("/api/git/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: currentProject.path }),
      });
      if (res.ok) {
        await fetchGitData();
      }
    } catch (err) {
      setError("Failed to initialize repository");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!currentProject || !commitMessage) return;
    setLoading(true);
    try {
      const res = await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectPath: currentProject.path, 
          message: commitMessage 
        }),
      });
      if (res.ok) {
        setCommitMessage("");
        await fetchGitData();
      }
    } catch (err) {
      setError("Failed to commit changes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    const name = prompt("Enter new branch name:");
    if (!name || !currentProject) return;
    setLoading(true);
    try {
      const res = await fetch("/api/git/branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: currentProject.path, name }),
      });
      if (res.ok) await fetchGitData();
    } catch (err) {
      setError("Failed to create branch");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (name: string) => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await fetch("/api/git/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: currentProject.path, name }),
      });
      if (res.ok) await fetchGitData();
    } catch (err) {
      setError("Failed to checkout branch");
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    const theirRef = prompt("Enter branch name to merge into current branch:");
    if (!theirRef || !currentProject) return;
    setLoading(true);
    try {
      const res = await fetch("/api/git/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: currentProject.path, theirRef }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.alreadyMerged) {
          alert("Already up to date.");
        } else if (data.fastForward) {
          alert("Fast-forward merge successful.");
        } else {
          alert("Merge successful.");
        }
        await fetchGitData();
      } else {
        setError(data.error || "Merge failed (conflicts?)");
      }
    } catch (err) {
      setError("Failed to merge branch");
    } finally {
      setLoading(false);
    }
  };

  const changedFiles = status.filter(s => s.workdir !== s.stage || (s.workdir === 2 && s.head === 0));

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40 p-8 text-center">
        <GitBranch className="w-12 h-12 mb-4 opacity-20" />
        <p>Select a project to use Git version control</p>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <GitBranch className="w-8 h-8 text-white/60" />
        </div>
        <h3 className="text-xl font-medium mb-2">Initialize Repository</h3>
        <p className="text-white/40 mb-8 max-w-xs">
          This project is not yet a Git repository. Initialize it to start tracking changes.
        </p>
        <button
          onClick={handleInit}
          disabled={loading}
          className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Initializing..." : "Initialize Git"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#050505]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5">
            <GitBranch className="w-4 h-4 text-white/60" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Source Control</h3>
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {currentBranch}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleMerge}
            title="Merge Branch"
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
          >
            <GitMerge className="w-4 h-4" />
          </button>
          <button 
            onClick={fetchGitData}
            title="Refresh Status"
            className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Changes Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] uppercase tracking-wider font-bold text-white/30">Changes</h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
              {changedFiles.length}
            </span>
          </div>
          
          {changedFiles.length > 0 ? (
            <div className="space-y-1">
              {changedFiles.map((file) => (
                <div 
                  key={file.filepath}
                  className="group flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-4 h-4 text-white/20 shrink-0" />
                    <span className="text-xs text-white/70 truncate">{file.filepath}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.workdir === 2 && file.head === 0 ? (
                      <span className="text-[10px] text-emerald-400 font-medium">Added</span>
                    ) : file.workdir === 2 ? (
                      <span className="text-[10px] text-amber-400 font-medium">Modified</span>
                    ) : file.workdir === 1 ? (
                      <span className="text-[10px] text-red-400 font-medium">Deleted</span>
                    ) : null}
                  </div>
                </div>
              ))}

              <div className="mt-4 space-y-3">
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors resize-none"
                />
                <button
                  onClick={handleCommit}
                  disabled={loading || !commitMessage}
                  className="w-full py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <GitCommit className="w-4 h-4" />
                  Commit Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center">
              <Check className="w-8 h-8 text-emerald-500/20 mb-2" />
              <p className="text-xs text-white/20">No changes detected</p>
            </div>
          )}
        </section>

        {/* Branches Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] uppercase tracking-wider font-bold text-white/30">Branches</h4>
            <button 
              onClick={handleCreateBranch}
              className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1">
            {branches.map((branch) => (
              <button
                key={branch}
                onClick={() => handleCheckout(branch)}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg transition-colors group",
                  currentBranch === branch ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/40 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <GitBranch className={cn("w-4 h-4", currentBranch === branch ? "text-white" : "text-white/20")} />
                  <span className="text-xs truncate">{branch}</span>
                </div>
                {currentBranch === branch && <Check className="w-3 h-3 text-emerald-400" />}
              </button>
            ))}
          </div>
        </section>

        {/* History Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] uppercase tracking-wider font-bold text-white/30">Commit History</h4>
            <History className="w-3 h-3 text-white/20" />
          </div>
          <div className="space-y-4">
            {log.map((item) => (
              <div key={item.oid} className="relative pl-6 pb-4 last:pb-0">
                <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-white/10 border border-white/20" />
                <div className="absolute left-[3px] top-4 bottom-0 w-[1px] bg-white/5 last:hidden" />
                
                <div className="space-y-1">
                  <p className="text-xs text-white/80 font-medium line-clamp-2">{item.commit.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-white/30">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {item.commit.author.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.commit.author.timestamp * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <code className="block text-[9px] text-white/20 font-mono mt-1">
                    {item.oid.substring(0, 7)}
                  </code>
                </div>
              </div>
            ))}
            {log.length === 0 && (
              <p className="text-xs text-white/20 text-center py-4">No commits yet</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
