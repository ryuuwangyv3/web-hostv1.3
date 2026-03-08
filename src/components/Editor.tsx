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

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language?: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, language = "typescript", readOnly = false }) => {
  const highlight = (code: string) => {
    const lang = Prism.languages[language] || Prism.languages.javascript;
    return Prism.highlight(code, lang, language);
  };

  return (
    <div className="relative w-full h-full overflow-auto bg-transparent">
      <Editor
        value={code}
        onValueChange={onChange}
        highlight={highlight}
        padding={12}
        className="editor-container min-h-full"
        readOnly={readOnly}
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 13,
        }}
      />
    </div>
  );
};
