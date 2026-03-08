export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface LogEntry {
  id: string;
  type: "log" | "error" | "warn" | "info";
  content: any[];
  timestamp: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}
