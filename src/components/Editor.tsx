import React from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/themes/prism-tomorrow.css";
import { useSettings } from "../contexts/SettingsContext";
import { Sparkles, Loader2 } from "lucide-react";
import { GoogleGenAI } from "@google/genai";

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language?: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, language = "typescript", readOnly = false }) => {
  const { settings } = useSettings();
  const [suggesting, setSuggesting] = React.useState(false);

  const highlight = (code: string) => {
    const lang = Prism.languages[language] || Prism.languages.javascript;
    return Prism.highlight(code, lang, language);
  };

  const handleAISuggest = async () => {
    if (suggesting || !code.trim()) return;
    setSuggesting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Suggest a small improvement or the next few lines for this ${language} code:\n\n${code}\n\nProvide ONLY the improved code block or the next lines. No explanation.`,
      });
      
      const suggestion = response.text;
      if (suggestion) {
        // Simple heuristic to extract code from markdown if AI returns it
        const codeMatch = suggestion.match(/```(?:\w+)?\n([\s\S]*?)```/) || [null, suggestion];
        const newCode = codeMatch[1].trim();
        onChange(code + "\n" + newCode);
      }
    } catch (err) {
      console.error("AI Suggestion failed", err);
    } finally {
      setSuggesting(false);
    }
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="relative w-full h-full overflow-auto bg-transparent flex group">
      {settings.showLineNumbers && (
        <div 
          className="flex flex-col text-right pr-4 select-none text-white/20 font-mono pt-3 border-r border-white/5 bg-white/[0.02]"
          style={{ fontSize: settings.fontSize, minWidth: '3rem' }}
        >
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i} className="h-[1.5em] leading-[1.5em]">
              {i + 1}
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 relative">
        <Editor
          value={code}
          onValueChange={onChange}
          highlight={highlight}
          padding={12}
          className={`editor-container min-h-full ${settings.wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
          readOnly={readOnly}
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: settings.fontSize,
            lineHeight: '1.5em',
          }}
        />
        
        {settings.aiSuggestions && !readOnly && (
          <button
            onClick={handleAISuggest}
            disabled={suggesting}
            className="absolute bottom-4 right-4 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-10"
            title="AI Suggest"
          >
            {suggesting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          </button>
        )}
      </div>
    </div>
  );
};
