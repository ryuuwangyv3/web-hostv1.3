import React from "react";
import { Terminal, Trash2, ChevronRight, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface LogEntry {
  id: string;
  type: "log" | "error" | "warn" | "info";
  content: any[];
  timestamp: string;
}

interface ConsoleTabProps {
  projectPath?: string;
}

export const ConsoleTab: React.FC<ConsoleTabProps> = ({ projectPath }) => {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [input, setInput] = React.useState("");
  const [executing, setExecuting] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
    };

    const createLogEntry = (type: LogEntry["type"], ...args: any[]): LogEntry => ({
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }),
      timestamp: new Date().toLocaleTimeString(),
    });

    const hookConsole = (type: LogEntry["type"]) => {
      console[type] = (...args: any[]) => {
        originalConsole[type](...args);
        setLogs(prev => [...prev, createLogEntry(type, ...args)].slice(-100));
      };
    };

    hookConsole("log");
    hookConsole("error");
    hookConsole("warn");
    hookConsole("info");

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "AKASHA_CONSOLE_LOG") {
        setLogs(prev => [...prev, createLogEntry(event.data.logType, ...event.data.args)].slice(-100));
      }
    };

    window.addEventListener("message", handleMessage);

    // Initial welcome message
    setLogs([createLogEntry("info", "Akasha Console initialized. Real-time logging active.")]);

    return () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const command = input.trim();
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type: "log",
      content: [`> ${command}`],
      timestamp: new Date().toLocaleTimeString()
    }]);

    const shellCommands = [
      "npm", "yarn", "node", "python", "pip", "php", "ls", "mkdir", "rm", 
      "cat", "git", "vite", "tsc", "touch", "cp", "mv", "echo", "pwd", "sh", "bash", "check"
    ];

    const isShell = shellCommands.some(cmd => command.startsWith(cmd + " ") || command === cmd);

    if (isShell) {
      setExecuting(true);
      try {
        const res = await fetch("/api/shell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, projectPath }),
        });
        const data = await res.json();
        
        if (data.validationFailed) {
          console.error("⚠️ Pre-execution Validation Failed:");
          console.error(data.stderr);
        } else if (command === "check" && data.success) {
          console.log(data.stdout);
        } else {
          if (data.stdout) console.log(data.stdout);
          if (data.stderr) console.error(data.stderr);
          if (data.error) console.error(`Execution Error: ${data.error}`);
        }

        // Dispatch event to refresh file tree
        window.dispatchEvent(new CustomEvent("AKASHA_REFRESH_FILES"));
      } catch (err: any) {
        console.error(`Fetch Error: ${err.message}`);
      } finally {
        setExecuting(false);
      }
    } else {
      try {
        // Use indirect eval to run in global scope
        const result = (0, eval)(command);
        if (result !== undefined) {
          console.log(result);
        }
      } catch (err: any) {
        console.error(err.message);
      }
    }

    setInput("");
  };

  const clearConsole = () => {
    setLogs([]);
    window.dispatchEvent(new CustomEvent("AKASHA_CLEAR_LOGS"));
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] font-mono text-xs">
      {/* Console Header */}
      <div className="h-8 border-b border-white/5 bg-white/5 flex items-center justify-between px-3">
        <div className="flex items-center gap-2 text-white/40">
          <Terminal size={11} />
          <span className="text-[9px] font-bold uppercase tracking-widest">System Console</span>
        </div>
        <button 
          onClick={clearConsole}
          className="p-1 hover:bg-white/10 rounded-md text-white/20 hover:text-white transition-all"
          title="Clear Console"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Logs Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex gap-3 py-1 border-b border-white/[0.02] last:border-none",
                log.type === "error" ? "text-red-400 bg-red-500/5" :
                log.type === "warn" ? "text-yellow-400 bg-yellow-500/5" :
                log.type === "info" ? "text-blue-400" : "text-white/80"
              )}
            >
              <span className="text-white/20 shrink-0 select-none">[{log.timestamp}]</span>
              <div className="shrink-0 mt-0.5">
                {log.type === "error" && <AlertCircle size={12} />}
                {log.type === "warn" && <AlertTriangle size={12} />}
                {log.type === "info" && <Info size={12} />}
                {log.type === "log" && <ChevronRight size={12} className="text-white/20" />}
              </div>
              <div className="flex-1 whitespace-pre-wrap break-all">
                {log.content.join(" ")}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleExecute}
        className="h-10 border-t border-white/5 bg-white/5 flex items-center px-3 gap-2"
      >
        <ChevronRight size={12} className="text-indigo-500" />
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={executing}
          placeholder={executing ? "Executing..." : "Execute JS or Shell..."}
          className="flex-1 bg-transparent outline-none text-white/80 placeholder:text-white/10 disabled:opacity-50 text-[11px]"
        />
        {executing && (
          <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        )}
      </form>
    </div>
  );
};
