'use client';

import { useRef, useCallback } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

function ToolbarButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, rows = 6 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  }, [exec]);

  const iconSize = 16;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <ToolbarButton onClick={() => exec('bold')}>
          <Bold size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')}>
          <Italic size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')}>
          <Underline size={iconSize} />
        </ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolbarButton onClick={() => exec('insertOrderedList')}>
          <ListOrdered size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('insertUnorderedList')}>
          <List size={iconSize} />
        </ToolbarButton>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolbarButton onClick={handleLink}>
          <Link size={iconSize} />
        </ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
        className="px-3 py-2 outline-none prose prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        style={{ minHeight: `${rows * 1.5}rem` }}
      />
    </div>
  );
}
