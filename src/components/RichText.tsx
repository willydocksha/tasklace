"use client";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { useEffect, useRef, useState } from "react";

const lowlight = createLowlight(common);

// languages offered in the code block picker (value = lowlight name)
const LANGS: [string, string][] = [
  ["", "Plain text"], ["json", "JSON"], ["javascript", "JavaScript"], ["typescript", "TypeScript"], ["sql", "SQL"],
  ["bash", "Bash"], ["python", "Python"], ["go", "Go"], ["php", "PHP"], ["java", "Java"], ["xml", "HTML / XML"], ["css", "CSS"], ["yaml", "YAML"],
];

// shared extension set: markdown in/out, gfm task lists, highlighted code blocks
const extensions = (placeholder: string, onTick: (node: PMNode, checked: boolean) => boolean) => [
  StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
  CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
  TaskList,
  // checklists can be ticked in view mode too
  TaskItem.configure({ nested: true, onReadOnlyChecked: onTick }),
  Placeholder.configure({ placeholder }),
  // breaks: single newlines in old plain-text descriptions stay as line breaks
  Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
];

// markdown description: formatted view, click to edit with a toolbar
export function RichText({ value, onSave, placeholder = "Tulis sesuatu…", empty = "Klik untuk menambah deskripsi…" }: {
  value: string;
  onSave: (markdown: string) => void;
  placeholder?: string;
  empty?: string;
}) {
  const [editing, setEditing] = useState(false);
  const save = useRef(onSave);
  save.current = onSave;
  const ed = useRef<Editor | null>(null);

  // read-only tick: tiptap only reports it, so update the node and save here
  function tick(node: PMNode, checked: boolean) {
    const e = ed.current;
    if (!e) return false;
    let pos = -1;
    e.state.doc.descendants((n, p) => {
      if (n === node) pos = p;
      return pos < 0;
    });
    if (pos < 0) return false;
    e.view.dispatch(e.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked }));
    save.current(e.getMarkdown().trim());
    return true;
  }

  const editor = useEditor({
    extensions: extensions(placeholder, tick),
    content: value,
    contentType: "markdown",
    editable: false,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: "rich outline-none" } },
  });

  ed.current = editor;

  // reload when the card (or its description from realtime) changes while not editing
  useEffect(() => {
    if (editor && !editing && editor.getMarkdown() !== value) editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value, editing]);

  // toggle edit mode on the same editor instance
  function start() {
    if (!editor) return;
    editor.setEditable(true);
    setEditing(true);
  }
  // focus once the editor is visible
  useEffect(() => {
    if (editing) editor?.commands.focus("end");
  }, [editing, editor]);
  function stop(save: boolean) {
    if (!editor) return;
    const md = editor.getMarkdown().trim();
    if (save && md !== value.trim()) onSave(md);
    else if (!save) editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    editor.setEditable(false);
    setEditing(false);
  }

  const isEmpty = !value.trim();
  return (
    <div>
      <div
        onClick={(e) => !editing && !(e.target as HTMLElement).closest("a, label, input") && start()}
        className={editing ? "rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-blue-400" : "min-h-16 cursor-text rounded-md bg-slate-50 p-2.5 hover:bg-slate-100"}
      >
        {editing && editor && <Toolbar editor={editor} />}
        {!editing && isEmpty && <span className="text-sm text-slate-400">{empty}</span>}
        <div onClick={(e) => editing && e.target === e.currentTarget && editor?.commands.focus("end")} className={editing ? "max-h-[60vh] min-h-40 cursor-text overflow-y-auto p-3" : isEmpty ? "hidden" : ""}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" onClick={() => stop(true)}>Simpan</button>
          <button className="rounded px-3 py-1.5 text-sm hover:bg-slate-100" onClick={() => stop(false)}>Batal</button>
          <span className="ml-auto hidden text-xs text-slate-400 sm:block">Tips: ketik <code># </code>, <code>- </code>, <code>1. </code>, <code>[] </code> atau <code>```</code></span>
        </div>
      )}
    </div>
  );
}

// formatting toolbar for the editor
function Toolbar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  const inCode = editor.isActive("codeBlock");

  // current block type for the style picker
  const block = editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : inCode ? "code" : "p";
  function setBlock(v: string) {
    if (v === "p") c().setParagraph().run();
    else if (v === "code") c().setCodeBlock().run();
    else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
  }

  // prompt for a link; empty input removes it
  function link() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = prompt("URL link", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const btn = (active: boolean, onClick: () => void, title: string, label: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm ${active ? "bg-blue-100 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {label}
    </button>
  );
  const sep = <span className="mx-0.5 h-5 w-px bg-slate-200" />;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-md border-b border-slate-200 bg-white px-1.5 py-1">
      <select value={block} onChange={(e) => setBlock(e.target.value)} onMouseDown={(e) => e.stopPropagation()} className="h-7 rounded px-1 text-sm text-slate-700 hover:bg-slate-100" title="Gaya teks">
        <option value="p">Teks biasa</option>
        <option value="h1">Judul 1</option>
        <option value="h2">Judul 2</option>
        <option value="h3">Judul 3</option>
        <option value="code">Kode</option>
      </select>
      {sep}
      {btn(editor.isActive("bold"), () => c().toggleBold().run(), "Tebal (⌘B)", <b>B</b>)}
      {btn(editor.isActive("italic"), () => c().toggleItalic().run(), "Miring (⌘I)", <i className="font-serif">I</i>)}
      {btn(editor.isActive("underline"), () => c().toggleUnderline().run(), "Garis bawah (⌘U)", <u>U</u>)}
      {btn(editor.isActive("strike"), () => c().toggleStrike().run(), "Coret", <s>S</s>)}
      {btn(editor.isActive("code"), () => c().toggleCode().run(), "Kode inline", <span className="font-mono text-xs">{"</>"}</span>)}
      {btn(editor.isActive("link"), link, "Link", "🔗")}
      {sep}
      {btn(editor.isActive("bulletList"), () => c().toggleBulletList().run(), "Daftar titik", "•≡")}
      {btn(editor.isActive("orderedList"), () => c().toggleOrderedList().run(), "Daftar angka", <span className="text-xs">1.≡</span>)}
      {btn(editor.isActive("taskList"), () => c().toggleTaskList().run(), "Checklist", "☑")}
      {sep}
      {btn(editor.isActive("blockquote"), () => c().toggleBlockquote().run(), "Kutipan", "❝")}
      {btn(inCode, () => c().toggleCodeBlock().run(), "Blok kode", <span className="font-mono text-xs">{"{ }"}</span>)}
      {btn(false, () => c().setHorizontalRule().run(), "Garis pemisah", "―")}
      {inCode && (
        <select
          value={(editor.getAttributes("codeBlock").language as string | null) ?? ""}
          onChange={(e) => c().updateAttributes("codeBlock", { language: e.target.value || null }).run()}
          className="ml-auto h-7 rounded border border-slate-200 px-1 font-mono text-xs text-slate-700"
          title="Bahasa kode"
        >
          {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
    </div>
  );
}
