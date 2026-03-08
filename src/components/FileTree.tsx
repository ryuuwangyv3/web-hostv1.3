import React from "react";
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  MoreVertical, 
  Copy, 
  Move 
} from "lucide-react";
import { cn } from "../lib/utils";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface FileTreeProps {
  nodes: FileNode[];
  onFileSelect: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (oldPath: string, newName: string) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  selectedPath?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({ 
  nodes, 
  onFileSelect, 
  onDelete, 
  onRename, 
  onCreateFile,
  onCreateFolder,
  selectedPath 
}) => {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeNode 
          key={node.path} 
          node={node} 
          onFileSelect={onFileSelect} 
          onDelete={onDelete}
          onRename={onRename}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          selectedPath={selectedPath}
          level={0}
        />
      ))}
    </div>
  );
};

const TreeNode: React.FC<{ 
  node: FileNode; 
  onFileSelect: (path: string) => void; 
  onDelete: (path: string) => void;
  onRename: (oldPath: string, newName: string) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  selectedPath?: string;
  level: number;
}> = ({ 
  node, 
  onFileSelect, 
  onDelete, 
  onRename, 
  onCreateFile,
  onCreateFolder,
  selectedPath, 
  level 
}) => {
  const [isOpen, setIsOpen] = React.useState(level === 0);
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState(node.name);
  const [menuOpen, setMenuOpen] = React.useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const isSelected = selectedPath === node.path;

  const handleClick = () => {
    if (isRenaming) return;
    if (node.type === "directory") {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node.path);
    }
  };

  const handleRenameSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newName && newName !== node.name) {
      onRename(node.path, newName);
    }
    setIsRenaming(false);
  };

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all duration-200 group text-[13px] relative",
          isSelected ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
        )}
        style={{ paddingLeft: `${level * 10 + 6}px` }}
      >
        {node.type === "directory" ? (
          <>
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Folder size={14} className={cn(isOpen ? "text-blue-400" : "text-blue-400/60")} />
          </>
        ) : (
          <>
            <div className="w-[12px]" />
            <File size={14} className={cn(isSelected ? "text-emerald-400" : "text-emerald-400/60")} />
          </>
        )}
        
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} className="flex-1 flex items-center gap-1 min-w-0">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => handleRenameSubmit()}
              className="flex-1 bg-white/10 border-none outline-none px-1 rounded text-xs py-0.5"
            />
            <button type="submit" className="text-emerald-400 hover:text-emerald-300">
              <Check size={12} />
            </button>
            <button type="button" onClick={() => setIsRenaming(false)} className="text-red-400 hover:text-red-300">
              <X size={12} />
            </button>
          </form>
        ) : (
          <>
            <span className="truncate flex-1">{node.name}</span>
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const target = e.currentTarget;
                  const rect = target.getBoundingClientRect();
                  setMenuOpen({ open: !menuOpen.open, x: rect.left, y: rect.bottom });
                }}
                className="p-1 hover:bg-white/20 rounded-md text-white/50 hover:text-white transition-all active:scale-90"
              >
                <MoreVertical size={14} />
              </button>

              {menuOpen.open && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen({ ...menuOpen, open: false });
                    }} 
                  />
                  <div 
                    className="fixed z-50 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 overflow-hidden"
                    style={{ left: `${menuOpen.x}px`, top: `${menuOpen.y}px` }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setIsRenaming(true);
                        setMenuOpen({ ...menuOpen, open: false });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Edit3 size={12} />
                      Rename
                    </button>
                    {node.type === "directory" && (
                      <>
                        <button
                          onClick={() => {
                            onCreateFile(node.path);
                            setMenuOpen({ ...menuOpen, open: false });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          <File size={12} />
                          New File
                        </button>
                        <button
                          onClick={() => {
                            onCreateFolder(node.path);
                            setMenuOpen({ ...menuOpen, open: false });
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                        >
                          <Folder size={12} />
                          New Folder
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(node.path);
                        setMenuOpen({ ...menuOpen, open: false });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Copy size={12} />
                      Copy Path
                    </button>
                    <button
                      onClick={() => {
                        const newPath = prompt("Enter new path (e.g. src/components/NewName.tsx):", node.path);
                        if (newPath && newPath !== node.path) {
                          onRename(node.path, newPath.split('/').pop() || "");
                        }
                        setMenuOpen({ ...menuOpen, open: false });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Move size={12} />
                      Move
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${node.name}?`)) {
                          onDelete(node.path);
                        }
                        setMenuOpen({ ...menuOpen, open: false });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {node.type === "directory" && isOpen && node.children && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <TreeNode 
              key={child.path} 
              node={child} 
              onFileSelect={onFileSelect} 
              onDelete={onDelete}
              onRename={onRename}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              selectedPath={selectedPath}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
