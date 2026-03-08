import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Zap, 
  Code, 
  Layout, 
  Activity, 
  Globe, 
  Play, 
  RotateCw, 
  Trash2,
  Terminal,
  ShieldAlert
} from "lucide-react";
import { cn } from "../lib/utils";

interface SandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SandboxTool = "dom" | "css" | "js" | "network";

export const SandboxModal: React.FC<SandboxModalProps> = ({ isOpen, onClose }) => {
  const [activeTool, setActiveTool] = React.useState<SandboxTool>("dom");
  const [domCode, setDomCode] = React.useState("<!-- Inject HTML here -->\n<div class='p-4 bg-indigo-500 text-white rounded-lg shadow-lg'>\n  Hello from Akasha Sandbox!\n</div>");
  const [cssCode, setCssCode] = React.useState("/* Override CSS here */\nbody {\n  filter: contrast(1.1);\n}");
  const [jsCode, setJsCode] = React.useState("// Execute JS here\nconsole.log('Akasha Sandbox Active');\nalert('Sandbox Script Executed!');");
  const [logs, setLogs] = React.useState<{type: string, msg: string, time: string}[]>([]);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const addLog = (type: string, msg: string) => {
    setLogs(prev => [{ type, msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  };

  const injectDOM = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      const container = iframe.contentDocument?.createElement('div');
      if (container) {
        container.innerHTML = domCode;
        iframe.contentDocument?.body.appendChild(container);
        addLog("success", "DOM Injected successfully");
      }
    } catch (err: any) {
      addLog("error", `DOM Injection failed: ${err.message}`);
    }
  };

  const injectCSS = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      const style = iframe.contentDocument?.createElement('style');
      if (style) {
        style.textContent = cssCode;
        iframe.contentDocument?.head.appendChild(style);
        addLog("success", "CSS Override applied");
      }
    } catch (err: any) {
      addLog("error", `CSS Injection failed: ${err.message}`);
    }
  };

  const injectJS = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      (iframe.contentWindow as any).eval(jsCode);
      addLog("success", "JS Script executed");
    } catch (err: any) {
      addLog("error", `JS Execution failed: ${err.message}`);
    }
  };

  const clearLogs = () => setLogs([]);
  const refreshPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = "/";
      addLog("info", "Preview refreshed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full h-full bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-[11px] font-bold text-white uppercase tracking-widest">Akasha Sandbox</h2>
              <p className="text-[9px] text-white/40">Real-time Runtime Injection</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-tighter">Live</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Preview */}
          <div className="flex-1 flex flex-col border-r border-white/5 bg-white">
            <div className="h-10 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-white/40" />
                <span className="text-[10px] text-white/40 font-mono">sandbox://runtime-preview</span>
              </div>
              <button 
                onClick={refreshPreview}
                className="p-1.5 hover:bg-white/10 rounded-md text-white/60 transition-colors"
              >
                <RotateCw size={12} />
              </button>
            </div>
            <iframe 
              ref={iframeRef}
              src="/" 
              className="flex-1 w-full border-none"
              title="Sandbox Preview"
            />
          </div>

          {/* Right: Controls */}
          <div className="w-[300px] md:w-[380px] flex flex-col bg-[#0a0a0a]">
            {/* Tool Tabs */}
            <div className="flex border-b border-white/5">
              {[
                { id: "dom", icon: Layout, label: "DOM" },
                { id: "css", icon: Activity, label: "CSS" },
                { id: "js", icon: Code, label: "JS" },
                { id: "network", icon: Globe, label: "Net" }
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id as SandboxTool)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-3 text-[9px] font-bold uppercase tracking-widest transition-all relative",
                    activeTool === tool.id ? "text-white" : "text-white/20 hover:text-white/40"
                  )}
                >
                  <tool.icon size={14} />
                  {tool.label}
                  {activeTool === tool.id && (
                    <motion.div layoutId="sandboxTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col p-4 space-y-3 overflow-hidden">
              <div className="flex-1 flex flex-col space-y-1.5 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Injection</span>
                  <span className="text-[9px] font-mono text-indigo-400/60">v1.0.4</span>
                </div>
                
                <div className="flex-1 bg-black/40 border border-white/5 rounded-xl overflow-hidden flex flex-col">
                  {activeTool === "network" ? (
                    <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                        <ShieldAlert size={24} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Interceptor</h4>
                        <p className="text-[10px] text-white/40 mt-1">Read-only mode.</p>
                      </div>
                    </div>
                  ) : (
                    <textarea 
                      value={activeTool === "dom" ? domCode : activeTool === "css" ? cssCode : jsCode}
                      onChange={(e) => {
                        if (activeTool === "dom") setDomCode(e.target.value);
                        else if (activeTool === "css") setCssCode(e.target.value);
                        else setJsCode(e.target.value);
                      }}
                      className="flex-1 w-full bg-transparent p-3 font-mono text-[11px] text-indigo-300/80 outline-none resize-none"
                      spellCheck={false}
                    />
                  )}
                </div>
              </div>

              <button 
                onClick={() => {
                  if (activeTool === "dom") injectDOM();
                  else if (activeTool === "css") injectCSS();
                  else if (activeTool === "js") injectJS();
                }}
                disabled={activeTool === "network"}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                <Play size={12} fill="currentColor" />
                Execute
              </button>
            </div>

            {/* Logs Area */}
            <div className="h-40 border-t border-white/5 bg-black/60 flex flex-col">
              <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-white/40">
                  <Terminal size={11} />
                  Sandbox Console
                </div>
                <button 
                  onClick={clearLogs}
                  className="p-1 hover:bg-white/10 rounded text-white/20 hover:text-white transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-1 scrollbar-hide">
                {logs.length === 0 ? (
                  <div className="text-white/10 italic">No activity recorded...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-white/20">[{log.time}]</span>
                      <span className={cn(
                        log.type === "error" ? "text-red-400" : 
                        log.type === "success" ? "text-emerald-400" : 
                        "text-blue-400"
                      )}>
                        {log.type.toUpperCase()}:
                      </span>
                      <span className="text-white/60">{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
