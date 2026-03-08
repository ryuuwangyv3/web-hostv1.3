import React from "react";
import { GoogleGenAI } from "@google/genai";
import { Send, Bot, User, Sparkles, Code2, RefreshCcw, Image as ImageIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { FileNode } from "./FileTree";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

interface ChatTabProps {
  currentCode: string;
  fileName: string | null;
  fileTree?: FileNode[];
  errorLogs?: string[];
  projectPath?: string;
  onApplyCode: (newCode: string) => void;
  onAutoCreate?: (project: { projectName: string; files: { path: string; content: string }[] }) => void;
  onExecuteCommand?: (command: string) => Promise<{ stdout: string; stderr: string; error?: string }>;
}

export const ChatTab: React.FC<ChatTabProps> = ({ currentCode, fileName, fileTree, errorLogs, projectPath, onApplyCode, onAutoCreate, onExecuteCommand }) => {
  const [messages, setMessages] = React.useState<Message[]>(() => {
    const saved = localStorage.getItem("akasha_chat_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = React.useState(() => {
    return localStorage.getItem("akasha_chat_input") || "";
  });
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const formatFileTree = (nodes: any[], indent = ""): string => {
    return nodes.map(node => {
      const line = `${indent}${node.type === "directory" ? "📁" : "📄"} ${node.name}`;
      if (node.children && node.children.length > 0) {
        return `${line}\n${formatFileTree(node.children, indent + "  ")}`;
      }
      return line;
    }).join("\n");
  };

  React.useEffect(() => {
    localStorage.setItem("akasha_chat_history", JSON.stringify(messages));
  }, [messages]);

  React.useEffect(() => {
    localStorage.setItem("akasha_chat_input", input);
  }, [input]);

  React.useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Halo! Aku Akasha. Ada yang bisa Aku bantu hari ini? Kamu bisa bertanya tentang kode, meminta bantuan debugging, atau meminta Aku untuk membuatkan fitur baru. Aku juga bisa membuatkan proyek full-stack web otomatis untukmu!"
      }]);
    }
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMessage = input.trim();
    const userImage = selectedImage;
    setInput("");
    setSelectedImage(null);
    setMessages(prev => [...prev, { role: "user", content: userMessage, image: userImage || undefined }]);
    setLoading(true);
    setStatus("Thinking...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const model = "gemini-3-flash-preview";
      
      const treeContext = fileTree ? `\nSTRUKTUR PROYEK LENGKAP (DEEP CONTEXT):\n${formatFileTree(fileTree)}` : "";
      const errorContext = errorLogs && errorLogs.length > 0 ? `\nLOG ERROR TERDETEKSI (AUTO-FIX MODE):\n${errorLogs.join("\n")}` : "";

      const systemInstruction = `[CORE PROTOCOL]
1. IDENTITY: dirimu adalah Akasha.
2. PRONOUNS: WAJIB gunakan "Aku" dan "Kamu".
3. LORE: Expert full stack developer, yang mampu membuat code dengan rapih, terstruktur, dan fungsional serta responsif untuk proyek standar Produksi. Dan mampu membuat system keamanan yang canggih untuk mencegah kebocoran data sensitif seperti URL dan APIKEY.

KONTEKS IDE (DEEP CONTEXT):
Kamu sedang membantu pengguna di Akasha IDE.${treeContext}${errorContext}
File yang sedang dibuka: ${fileName || "Tidak ada file yang dipilih"}.
Bahasa: ${fileName?.split(".").pop() || "plaintext"}.

KODE SAAT INI:
\`\`\`
${currentCode}
\`\`\`

FITUR SPESIAL: PROJECT MANAGEMENT (ADVANCED)
Kamu memiliki kemampuan untuk membuat, memperbarui, atau menghapus bagian dari proyek. Gunakan blok JSON di akhir jawaban Kamu untuk instruksi otomatis:

1. AUTO CREATE PROJECT:
\`\`\`json
{
  "type": "auto_create_project",
  "projectName": "Nama Proyek",
  "description": "Deskripsi",
  "files": [ { "path": "path/to/file", "content": "..." } ]
}
\`\`\`

2. UPDATE PROJECT (Modify/Add/Delete):
\`\`\`json
{
  "type": "update_project",
  "projectName": "Nama Proyek",
  "updates": [
    { "action": "modify", "path": "index.html", "content": "...kode baru..." },
    { "action": "add", "path": "js/new-feature.js", "content": "..." },
    { "action": "delete", "path": "old-file.css" }
  ]
}
\`\`\`

4. EXECUTE COMMAND (Shell/NPM):
\`\`\`json
{
  "type": "execute_command",
  "command": "npm install lodash"
}
\`\`\`

KRITERIA PROYEK & PEMBARUAN (STRICT RULES):
1. SURGICAL EDITS: JANGAN membuat ulang seluruh kode dari awal jika hanya sebagian kecil yang perlu diubah. Edit hanya bagian yang relevan untuk menjaga efisiensi dan integritas kode sebelumnya.
2. PRESERVE UI/UX: JANGAN mengubah desain UI/UX, fitur, atau menu yang sudah ada kecuali pengguna memintanya secara spesifik. Pertahankan estetika dan fungsionalitas proyek sebelumnya.
3. MANDATORY TAILWIND CSS: Gunakan Tailwind CSS secara otomatis untuk semua styling pada proyek yang Kamu buat atau perbarui.
4. DEEP CONTEXT: Analisis seluruh struktur file untuk memastikan konsistensi saat menambah fitur atau mengubah desain.
5. AUTO-FIX: Jika ada log error, prioritaskan perbaikan pada file yang relevan. Jelaskan penyebab error dan bagaimana Kamu memperbaikinya.
6. SARAN PROAKTIF: Berikan saran peningkatan (fitur, performa, atau UI) dan tawarkan untuk mengeksekusinya.
7. MULTI-PAGE & FULL-STACK: Selalu pertahankan standar multi-halaman dan logika fungsional (LocalStorage/API).

INSTRUKSI:
1. Berikan penjelasan yang jelas dan ringkas tentang perubahan atau saran yang Kamu berikan.
2. Gunakan bahasa Indonesia yang ramah dan profesional.
3. Fokus pada praktik terbaik, keamanan, dan performa.
4. JANGAN PERNAH membocorkan API KEY atau URL sensitif.
5. Jika ada error, berikan log perbaikan secara detail.
`;

      const parts: any[] = [{ text: userMessage }];
      if (userImage) {
        parts.push({
          inlineData: {
            mimeType: userImage.split(";")[0].split(":")[1],
            data: userImage.split(",")[1]
          }
        });
      }

      const response = await ai.models.generateContent({
        model,
        contents: messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })).concat({
          role: "user",
          parts: parts
        }),
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const aiContent = response.text || "Maaf, Aku tidak bisa memproses permintaan itu.";
      
      // Remove code blocks from aiContent to avoid duplication
      const textWithoutCode = aiContent.replace(/```(?:\w+)?\n[\s\S]*?```/g, "").trim();
      
      setMessages(prev => [...prev, { role: "assistant", content: textWithoutCode }]);

      // Check for JSON actions
      const jsonMatch = aiContent.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && onAutoCreate) {
        setStatus("Menyusun Rencana...");
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          if (jsonData.type === "auto_create_project") {
            setStatus(`Membuat proyek "${jsonData.projectName}"...`);
            await onAutoCreate({
              projectName: jsonData.projectName,
              files: jsonData.files
            });
            setMessages(prev => [...prev, { role: "assistant", content: `✅ Proyek "${jsonData.projectName}" berhasil dibuat dan siap di-preview!` }]);
          } else if (jsonData.type === "update_project") {
            setStatus(`Memperbarui proyek "${jsonData.projectName}"...`);
            for (const update of jsonData.updates) {
              setStatus(`Mengedit ${update.path}...`);
              await onAutoCreate({
                projectName: jsonData.projectName,
                files: [update]
              });
            }
            setMessages(prev => [...prev, { role: "assistant", content: `✅ Proyek "${jsonData.projectName}" berhasil diperbarui!` }]);
          } else if (jsonData.type === "execute_command" && onExecuteCommand) {
            setStatus(`Menjalankan perintah: \`${jsonData.command}\`...`);
            const result = await onExecuteCommand(jsonData.command);
            if (result.error || result.stderr) {
              setMessages(prev => [...prev, { role: "assistant", content: `❌ Gagal menjalankan perintah.\nError: ${result.error || result.stderr}` }]);
            } else {
              setMessages(prev => [...prev, { role: "assistant", content: `✅ Perintah berhasil dijalankan!\nOutput:\n\`\`\`\n${result.stdout}\n\`\`\`` }]);
            }
          }
        } catch (e) {
          console.error("Failed to parse AI JSON action", e);
        }
      }
      setStatus("Finishing...");
      await new Promise(resolve => setTimeout(resolve, 500));
      setStatus("Completed...");
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error("Chat Error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Terjadi kesalahan saat menghubungi Akasha. Pastikan koneksi internet stabil." }]);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const extractCodeBlocks = (text: string) => {
    const regex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden">
      {/* Messages Area */}
      <div className="h-10 border-b border-white/5 bg-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-white/40">
          <Sparkles size={12} className="text-indigo-400" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Akasha AI Assistant</span>
        </div>
        <button 
          onClick={() => {
            if (confirm("Hapus seluruh riwayat chat?")) {
              setMessages([{
                role: "assistant",
                content: "Halo! Aku Akasha. Ada yang bisa Aku bantu hari ini?"
              }]);
              localStorage.removeItem("akasha_chat_history");
            }
          }}
          className="p-1 hover:bg-white/10 rounded-md text-white/20 hover:text-white transition-all"
          title="Clear Chat"
        >
          <RefreshCcw size={12} />
        </button>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 text-indigo-400">
              <Sparkles size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Halo! Aku Akasha.</h3>
            <p className="text-sm text-white/40 max-w-xs">
              Aku bisa membantumu menulis kode, mencari bug, atau menjelaskan cara kerja file ini. Apa yang bisa Aku bantu hari ini?
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-4",
                msg.role === "assistant" ? "items-start" : "items-start flex-row-reverse"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border",
                msg.role === "assistant" 
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
                  : "bg-white/10 border-white/10 text-white/60"
              )}>
                {msg.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
              </div>
              
              <div className={cn(
                "flex-1 max-w-[85%] space-y-3",
                msg.role === "user" && "text-right"
              )}>
                <div className={cn(
                  "text-sm leading-relaxed whitespace-pre-wrap p-3 rounded-2xl",
                  msg.role === "assistant" 
                    ? "bg-white/5 text-white/80 rounded-tl-none" 
                    : "bg-indigo-600 text-white rounded-tr-none ml-auto inline-block text-left"
                )}>
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="User uploaded" 
                      className="max-w-full rounded-lg mb-2 border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {msg.content}
                </div>

                {msg.role === "assistant" && extractCodeBlocks(msg.content).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {extractCodeBlocks(msg.content).map((block, idx) => (
                      <button
                        key={idx}
                        onClick={() => onApplyCode(block)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                      >
                        <Code2 size={12} />
                        Apply Code Block {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        {loading && (
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
              <Bot size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-indigo-400 font-medium uppercase tracking-wider">{status || "Thinking..."}</div>
              <div className="flex items-center gap-1 text-white/20">
                <div className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-[#0a0a0a]">
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative mb-3 inline-block"
            >
              <img 
                src={selectedImage} 
                alt="Selected" 
                className="h-20 w-20 object-cover rounded-lg border border-white/20"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="relative group flex items-end gap-2">
          <div className="relative flex-1">
            <textarea 
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Tanya Akasha..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all resize-none max-h-32"
            />
            <button 
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-indigo-400 transition-colors"
            >
              <ImageIcon size={18} />
            </button>
            <input 
              type="file" 
              ref={imageInputRef} 
              onChange={handleImageSelect} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          <button 
            type="submit"
            disabled={(!input.trim() && !selectedImage) || loading}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-[9px] text-white/20 mt-2 text-center uppercase tracking-widest font-medium">
          Powered by Gemini 3 Flash
        </p>
      </div>
    </div>
  );
};
