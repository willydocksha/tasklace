"use client";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Extension } from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { useEffect, useRef, useState } from "react";
import { Kbd, Select, type Option } from "@/components/ui/Select";
import { promptDialog, toastError } from "@/components/ui/Dialog";
import { FORMATTABLE, formatCode } from "@/lib/codeFormat";

const lowlight = createLowlight(common);

// languages offered in the code block picker (value = lowlight name)
const LANGS: [string, string][] = [
  ["", "Plain text"], ["json", "JSON"], ["javascript", "JavaScript"], ["typescript", "TypeScript"], ["sql", "SQL"],
  ["bash", "Bash"], ["python", "Python"], ["go", "Go"], ["php", "PHP"], ["java", "Java"], ["xml", "HTML / XML"], ["css", "CSS"], ["yaml", "YAML"],
];

// replace the code block around the cursor with its formatted version
async function formatBlock(editor: Editor) {
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== "codeBlock") return;
  const lang = ($from.parent.attrs.language as string | null) ?? "";
  const code = $from.parent.textContent;
  if (!code.trim()) return;
  const out = await formatCode(lang, code);
  // the doc may have changed while a formatter loaded; re-find the block
  const { $from: now } = editor.state.selection;
  if (now.parent.type.name !== "codeBlock" || now.parent.textContent !== code) return;
  const start = now.start();
  editor.chain().focus().command(({ tr }) => (tr.replaceWith(start, now.end(), editor.schema.text(out)), true)).run();
}

// code block extras: enter keeps indentation, shift+alt+f formats
const CodeHelpers = Extension.create({
  name: "codeHelpers",
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== "codeBlock") return false;
        // current line up to the cursor
        const before = $from.parent.textBetween(0, $from.parentOffset, "\n");
        const line = before.slice(before.lastIndexOf("\n") + 1);
        // blank lines fall through so triple-enter can still leave the block
        if (!line.trim()) return false;
        const indent = line.match(/^\s*/)![0] + (/[{[(]\s*$/.test(line) ? "  " : "");
        return editor.commands.insertContent("\n" + indent);
      },
      "Shift-Alt-f": ({ editor }) => {
        if (!editor.isActive("codeBlock")) return false;
        void formatBlock(editor).catch(toastError);
        return true;
      },
    };
  },
});

// shared extension set: markdown in/out, gfm task lists, highlighted code blocks
const extensions = (placeholder: string, onTick: (node: PMNode, checked: boolean) => boolean) => [
  StarterKit.configure({ codeBlock: false, link: { openOnClick: false, autolink: true, defaultProtocol: "https" } }),
  // tab / shift+tab indent inside code blocks instead of moving focus
  CodeBlockLowlight.configure({ lowlight, defaultLanguage: null, enableTabIndentation: true, tabSize: 2 }),
  CodeHelpers,
  TaskList,
  // checklists can be ticked in view mode too
  TaskItem.configure({ nested: true, onReadOnlyChecked: onTick }),
  Placeholder.configure({ placeholder }),
  // pasted / dropped pictures get their own line, stored as ![alt](url)
  Image,
  // breaks: single newlines in old plain-text descriptions stay as line breaks
  Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
];

// markdown description: formatted view, click to edit with a toolbar
export function RichText({ value, onSave, onImage, placeholder = "Tulis sesuatu…", empty = "Klik untuk menambah deskripsi…", readOnly = false }: {
  value: string;
  onSave: (markdown: string) => void;
  // uploads a pasted/dropped image and resolves to its url; no handler = no images
  onImage?: (file: File) => Promise<string>;
  placeholder?: string;
  empty?: string;
  // view only: no editing, checklists cannot be ticked
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const save = useRef(onSave);
  save.current = onSave;
  const ed = useRef<Editor | null>(null);
  const lockRef = useRef(readOnly);
  lockRef.current = readOnly;
  const imageRef = useRef(onImage);
  imageRef.current = onImage;
  // images still uploading; saving waits until they have real urls
  const [uploads, setUploads] = useState(0);

  // swap a local preview url for the uploaded one (or drop the image on failure)
  function swapImage(tmp: string, url: string | null) {
    const e = ed.current;
    if (!e) return;
    let at = -1;
    e.state.doc.descendants((n, p) => {
      if (n.type.name === "image" && n.attrs.src === tmp) at = p;
      return at < 0;
    });
    if (at < 0) return;
    const node = e.state.doc.nodeAt(at)!;
    e.view.dispatch(url ? e.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, src: url }) : e.state.tr.delete(at, at + node.nodeSize));
  }

  // insert pasted/dropped images at once with a local preview, then upload each
  function insertImages(view: EditorView, files: File[], pos?: number) {
    const upload = imageRef.current;
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!upload || !view.editable || !images.length) return false;
    for (const f of images) {
      const tmp = URL.createObjectURL(f);
      const node = view.state.schema.nodes.image.create({ src: tmp, alt: (f.name || "gambar").replace(/\.[^.]+$/, "") });
      view.dispatch(pos == null ? view.state.tr.replaceSelectionWith(node) : view.state.tr.replaceRangeWith(pos, pos, node));
      setUploads((n) => n + 1);
      upload(f)
        .then((url) => swapImage(tmp, url))
        .catch((err) => {
          swapImage(tmp, null);
          toastError(err);
        })
        .finally(() => {
          URL.revokeObjectURL(tmp);
          setUploads((n) => n - 1);
        });
    }
    return true;
  }

  // read-only tick: tiptap only reports it, so update the node and save here
  function tick(node: PMNode, checked: boolean) {
    const e = ed.current;
    if (!e || lockRef.current) return false;
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
    editorProps: {
      attributes: { class: "rich outline-none" },
      handlePaste: (view, e) => insertImages(view, [...(e.clipboardData?.files ?? [])]),
      handleDrop: (view, e) => {
        const files = [...(e.dataTransfer?.files ?? [])];
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })?.pos;
        if (!insertImages(view, files, pos)) return false;
        e.preventDefault();
        return true;
      },
    },
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
  // focus once the editor is visible; a doc ending in an image gets a line to type on
  useEffect(() => {
    if (!editing || !editor) return;
    const last = editor.state.doc.lastChild;
    if (last && !last.isTextblock) editor.commands.insertContentAt(editor.state.doc.content.size, { type: "paragraph" });
    editor.commands.focus("end");
  }, [editing, editor]);
  function stop(save: boolean) {
    if (!editor || (save && uploads > 0)) return;
    // drop trailing empty lines (they serialize as &nbsp;)
    const md = editor.getMarkdown().replace(/(\s|&nbsp;)+$/, "").trim();
    if (save && md !== value.trim()) onSave(md);
    else if (!save) editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
    editor.setEditable(false);
    setEditing(false);
  }

  // clicking anywhere outside the editor (or its dropdowns) saves and closes it
  const box = useRef<HTMLDivElement>(null);
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (!editing) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!box.current?.contains(t) && !t.closest("[data-popover]")) stopRef.current(true);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [editing]);

  const isEmpty = !value.trim();
  return (
    <div ref={box}>
      <div
        onClick={(e) => !editing && !readOnly && !(e.target as HTMLElement).closest("a, label, input") && start()}
        className={readOnly && !editing ? "min-h-16 rounded-lg bg-slate-50 p-2.5" : editing ? "rounded-lg border border-blue-400 bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-3 ring-blue-100" : "min-h-16 cursor-text rounded-lg border border-transparent bg-slate-50 p-2.5 transition hover:border-slate-200 hover:bg-slate-100/70"}
      >
        {editing && editor && <Toolbar editor={editor} />}
        {!editing && isEmpty && <span className="text-sm text-slate-400">{readOnly ? "Tidak ada deskripsi" : empty}</span>}
        <div onClick={(e) => editing && e.target === e.currentTarget && editor?.commands.focus("end")} className={editing ? "max-h-[60vh] min-h-40 cursor-text overflow-y-auto p-3" : isEmpty ? "hidden" : ""}>
          <EditorContent editor={editor} />
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <button className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 dark:hover:bg-blue-500" onClick={() => stop(true)} disabled={uploads > 0}>{uploads > 0 ? "Mengunggah gambar…" : "Simpan"}</button>
          <button className="rounded-lg px-3.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onClick={() => stop(false)}>Batal</button>
          <span className="ml-auto hidden text-xs text-slate-400 sm:block">Tips: ketik <code>#</code> <code>-</code> <code>1.</code> <code>[]</code> + spasi, atau <code>```</code>{onImage && " · tempel gambar langsung"}</span>
        </div>
      )}
    </div>
  );
}

// text style menu rows: live preview of each style + its shortcut
const HEADING_CLS = ["", "text-2xl font-bold", "text-xl font-bold", "text-lg font-semibold", "text-base font-semibold", "text-sm font-semibold", "text-xs font-semibold uppercase tracking-wide text-slate-500"];
const STYLES: Option<string>[] = [
  { value: "p", label: "Teks biasa", icon: <span className="text-sm font-semibold text-slate-500">Tt</span>, hint: <Kbd>⌘⌥0</Kbd> },
  ...[1, 2, 3, 4, 5, 6].map((l) => ({
    value: `h${l}`,
    label: `Judul ${l}`,
    icon: <span className="text-xs font-semibold text-slate-500">H<sub>{l}</sub></span>,
    render: <span className={`block truncate leading-tight ${HEADING_CLS[l]}`}>Judul {l}</span>,
    hint: <Kbd>⌘⌥{l}</Kbd>,
  })),
  { value: "code", label: "Blok kode", icon: <span className="font-mono text-xs whitespace-nowrap text-slate-500">{"{}"}</span>, render: <span className="font-mono text-[13px]">Blok kode</span>, hint: <Kbd><span className="font-mono">```</span></Kbd> },
];

// formatting toolbar for the editor
function Toolbar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  const inCode = editor.isActive("codeBlock");

  // current block type for the style picker
  const level = ([1, 2, 3, 4, 5, 6] as const).find((l) => editor.isActive("heading", { level: l }));
  const block = level ? `h${level}` : inCode ? "code" : "p";
  function setBlock(v: string) {
    if (v === "p") c().setParagraph().run();
    else if (v === "code") c().setCodeBlock().run();
    else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  }

  // prompt for a link; empty input removes it
  async function link() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = await promptDialog({ title: prev ? "Ubah link" : "Tambah link", message: "Kosongkan untuk menghapus link.", defaultValue: prev ?? "https://", placeholder: "https://", confirmLabel: "Simpan" });
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
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-slate-200 bg-surface px-1.5 py-1">
      <Select
        variant="toolbar"
        value={block}
        options={STYLES}
        onChange={setBlock}
        menuWidth={300}
        title="Gaya teks"
        renderValue={(o) => <span className="font-semibold">{o?.value === "p" ? "Tt" : o?.value === "code" ? "{ }" : o?.value.toUpperCase()}</span>}
      />
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
      {inCode && <CodeBar editor={editor} />}
    </div>
  );
}

// second toolbar row while the cursor is in a code block: language + format
function CodeBar({ editor }: { editor: Editor }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const lang = (editor.getAttributes("codeBlock").language as string | null) ?? "";

  // clear a stale error when the code or language changes
  const code = editor.state.selection.$from.parent.textContent;
  useEffect(() => setErr(""), [code, lang]);

  async function run() {
    setBusy(true);
    try {
      await formatBlock(editor);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-t border-slate-100 pt-1">
      <Select
        variant="toolbar"
        searchable
        value={lang}
        options={LANGS.map(([v, l]) => ({ value: v, label: l, hint: FORMATTABLE.has(v) ? <span className="text-[11px]">✨</span> : undefined }))}
        onChange={(v) => editor.chain().focus().updateAttributes("codeBlock", { language: v || null }).run()}
        menuWidth={220}
        title="Bahasa kode"
        className="border border-slate-200 font-mono text-xs"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={run}
        disabled={busy || !FORMATTABLE.has(lang)}
        title={FORMATTABLE.has(lang) ? "Rapikan kode (⇧⌥F)" : "Pilih bahasa yang didukung: JSON, JS, TS, SQL, HTML, CSS, YAML"}
        className="flex h-7 items-center gap-1 rounded border border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
      >
        {busy ? "Merapikan…" : "✨ Format"}
      </button>
      <span className="text-xs text-slate-400">Tab = indent, ⇧Tab = mundur</span>
      {err && <span className="w-full truncate text-xs text-red-600" title={err}>{err}</span>}
    </div>
  );
}
