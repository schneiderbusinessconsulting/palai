'use client'

import { useRef, useCallback, useEffect } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Link, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Indent, Outdent, Quote,
  Undo2, Redo2, RemoveFormatting,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number  // in rem
}

function Btn({ onClick, title, children, active }: {
  onClick: () => void
  title: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-sm
        ${active
          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-0.5 flex-shrink-0" />
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 10 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)

  // Sync external value → editor (only when it changes externally)
  useEffect(() => {
    if (!editorRef.current) return
    if (value !== lastValueRef.current) {
      lastValueRef.current = value
      // Only update DOM if the HTML actually differs (avoids cursor jump)
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value
      }
    }
  }, [value])

  const emit = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    lastValueRef.current = html
    onChange(html)
  }, [onChange])

  const exec = useCallback((command: string, arg?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, arg ?? undefined)
    emit()
  }, [emit])

  const handleLink = useCallback(() => {
    const sel = window.getSelection()?.toString()
    const url = prompt('URL eingeben:', 'https://')
    if (url) exec('createLink', url)
    else if (sel) exec('unlink')
  }, [exec])

  const sz = 14

  return (
    <div className="flex flex-col border border-slate-300 dark:border-slate-600 rounded-xl overflow-hidden focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/30 transition-all bg-white dark:bg-slate-900">

      {/* ── Formatting Toolbar (Gmail row 1) ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex-wrap">

        {/* Undo / Redo */}
        <Btn onClick={() => exec('undo')} title="Rückgängig"><Undo2 size={sz} /></Btn>
        <Btn onClick={() => exec('redo')} title="Wiederholen"><Redo2 size={sz} /></Btn>

        <Divider />

        {/* Basic formatting */}
        <Btn onClick={() => exec('bold')} title="Fett (Strg+B)"><Bold size={sz} /></Btn>
        <Btn onClick={() => exec('italic')} title="Kursiv (Strg+I)"><Italic size={sz} /></Btn>
        <Btn onClick={() => exec('underline')} title="Unterstrichen (Strg+U)"><Underline size={sz} /></Btn>
        <Btn onClick={() => exec('strikeThrough')} title="Durchgestrichen"><Strikethrough size={sz} /></Btn>

        <Divider />

        {/* Text color chips */}
        <div className="flex items-center gap-0.5" title="Textfarbe">
          {['#1e293b','#dc2626','#16a34a','#2563eb','#d97706'].map(color => (
            <button
              key={color}
              type="button"
              title={color}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('foreColor', color)}
              className="w-4 h-4 rounded-sm border border-white/50 hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <Divider />

        {/* Alignment */}
        <Btn onClick={() => exec('justifyLeft')} title="Linksbündig"><AlignLeft size={sz} /></Btn>
        <Btn onClick={() => exec('justifyCenter')} title="Zentriert"><AlignCenter size={sz} /></Btn>
        <Btn onClick={() => exec('justifyRight')} title="Rechtsbündig"><AlignRight size={sz} /></Btn>
        <Btn onClick={() => exec('justifyFull')} title="Blocksatz"><AlignJustify size={sz} /></Btn>

        <Divider />

        {/* Lists */}
        <Btn onClick={() => exec('insertOrderedList')} title="Nummerierte Liste"><ListOrdered size={sz} /></Btn>
        <Btn onClick={() => exec('insertUnorderedList')} title="Aufzählungsliste"><List size={sz} /></Btn>

        {/* Indent */}
        <Btn onClick={() => exec('outdent')} title="Einzug verkleinern"><Outdent size={sz} /></Btn>
        <Btn onClick={() => exec('indent')} title="Einzug vergrößern"><Indent size={sz} /></Btn>

        {/* Blockquote */}
        <Btn onClick={() => exec('formatBlock', 'blockquote')} title="Zitat"><Quote size={sz} /></Btn>

        <Divider />

        {/* Link */}
        <Btn onClick={handleLink} title="Link einfügen"><Link size={sz} /></Btn>

        {/* Remove formatting */}
        <Btn onClick={() => exec('removeFormat')} title="Formatierung entfernen"><RemoveFormatting size={sz} /></Btn>
      </div>

      {/* ── Editable Area ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-compose
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        className="flex-1 px-4 py-3 outline-none text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-y-auto
          prose prose-sm dark:prose-invert max-w-none
          empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500
          [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600 [&_blockquote]:italic
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_a]:text-blue-600 [&_a]:underline"
        style={{ minHeight: `${minHeight}rem` }}
      />
    </div>
  )
}
