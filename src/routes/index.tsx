"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { 
  $getSelection, 
  $isRangeSelection, 
  FORMAT_TEXT_COMMAND, 
  CLEAR_EDITOR_COMMAND,
  $insertNodes,
  $createTextNode
} from "lexical";
import { $patchStyleText } from "@lexical/selection";
import { $generateHtmlFromNodes } from "@lexical/html";
import * as htmlToImage from "html-to-image";
import { 
  Download, Monitor, UserX, 
  UserCheck, Trash2, Bold, Italic, 
  Settings2, Sparkles, Layers, RotateCcw, 
  AlignLeft, MousePointer2, Wand2, SunMedium,
  Users, Plus, X,
  RefreshCcw
} from "lucide-react";
import { cn } from "../lib/utils";
import { createFileRoute, createRoute, createRouter } from "@tanstack/react-router";
// --- DOMYŚLNE USTAWIENIA ---
const DEFAULT_SETTINGS = {
  bgOn: true,
  showNames: true,
  font: "Arial",
  fontSize: 16,
  shadowDepth: 1.5,
  lineHeight: 1.3,
  padding: 40,
  brightness: 100
};
// --- KONFIGURACJA TEMATU ---
const theme = {
  paragraph: "gta-paragraph",
  text: {
    bold: "lexical-bold", 
    italic: "lexical-italic",
    underline: "lexical-underline",
    strikethrough: "lexical-strikethrough",
  },
};

const initialConfig = {
  namespace: "GTAChatProV6",
  theme,
  onError: (e: Error) => console.error(e),
};

// --- PLUGIN AUTOCOMPLETE DLA "/" ---
function SlashCommandPlugin({ players }: { players: string[] }) {
  const [editor] = useLexicalComposerContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showMenu) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % players.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + players.length) % players.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertPlayerName(players[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowMenu(false);
    }
  }, [showMenu, players, selectedIndex]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const insertPlayerName = (name: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Usuwamy "/" przed wstawieniem imienia
        selection.modify('extend', true, 'character');
        selection.insertText(name + ": ");
      }
    });
    setShowMenu(false);
  };

  return (
    <>
      <OnChangePlugin onChange={(editorState) => {
        editorState.read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const textContent = selection.anchor.getNode().getTextContent();
            const offset = selection.anchor.offset;
            const lastChar = textContent[offset - 1];

            if (lastChar === "/" && players.length > 0) {
              const domSelection = window.getSelection();
              if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setCoords({ top: rect.bottom + window.scrollY, left: rect.left });
                setShowMenu(true);
                setSelectedIndex(0);
              }
            } else {
              setShowMenu(false);
            }
          }
        });
      }} />

      {showMenu && (
        <div 
          className="fixed z-[100] bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[150px]"
          style={{ top: coords.top + 10, left: coords.left }}
        >
          <div className="p-2 bg-indigo-500/20 text-[10px] font-black uppercase text-indigo-400 border-b border-white/5">
            Wybierz gracza
          </div>
          {players.map((name, i) => (
            <div
              key={name}
              onClick={() => insertPlayerName(name)}
              className={cn(
                "px-4 py-2 text-sm cursor-pointer transition-colors",
                i === selectedIndex ? "bg-indigo-600 text-white" : "hover:bg-white/5 text-slate-300"
              )}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// --- PLUGIN LOGIKI PREVIEW ---
function PreviewPlugin({ onHTMLChange }: { onHTMLChange: (html: string) => void }) {
  const [editor] = useLexicalComposerContext();
  return (
    <OnChangePlugin onChange={(editorState) => {
      editorState.read(() => {
        const rawHtml = $generateHtmlFromNodes(editor, null);
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, "text/html");
        
        Array.from(doc.body.children).forEach((child) => {
          if (child.tagName === 'P') {
            const el = child as HTMLElement;
            const textContent = el.textContent || "";
            if (textContent.trim().startsWith("*")) {
              el.style.color = "#C2A2DA"; 
              el.querySelectorAll('span, strong, em, b, i').forEach(span => {
                (span as HTMLElement).style.color = 'inherit'; 
              });
            } else if (textContent.includes(":")) {
              const parts = el.innerHTML.split(":");
              if (parts.length > 1) {
                el.innerHTML = `<span class="chat-name-prefix">${parts[0]}:</span>${parts.slice(1).join(":")}`;
              }
            }
          }
        });
        onHTMLChange(doc.body.innerHTML);
      });
    }} />
  );
}

// --- GŁÓWNY KOMPONENT ---
export const Route = createFileRoute('/')({component: ChatGenerator});
export default function ChatGenerator() {
  const [mounted, setMounted] = useState(false);
  const [previewHTML, setPreviewHTML] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
  const [newPlayer, setNewPlayer] = useState("");

  const [settings, setSettings] = useState({
    bgOn: true,
    showNames: true,
    font: "Arial",
    fontSize: 16,
    shadowDepth: 1.5,
    lineHeight: 1.3,
    padding: 40,
    brightness: 100
  });

  useEffect(() => {
    const savedSettings = localStorage.getItem("gta_chat_v6_settings");
    const savedPlayers = localStorage.getItem("gta_chat_players");
    if (savedSettings) setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
    if (savedPlayers) setPlayers(JSON.parse(savedPlayers));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("gta_chat_v6_settings", JSON.stringify(settings));
      localStorage.setItem("gta_chat_players", JSON.stringify(players));
    }
  }, [settings, players, mounted]);

  const addPlayer = () => {
    if (newPlayer.trim() && !players.includes(newPlayer.trim())) {
      setPlayers([...players, newPlayer.trim()]);
      setNewPlayer("");
    }
  };
  const resetToDefaults = () => {
    if(confirm("Czy na pewno chcesz przywrócić domyślne ustawienia wyglądu?")) {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const removePlayer = (name: string) => {
    setPlayers(players.filter(p => p !== name));
  };

  const chatRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!chatRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await htmlToImage.toPng(chatRef.current, {
        backgroundColor: settings.bgOn ? "#000000" : "transparent",
        pixelRatio: 3,
      });
      const link = document.createElement("a");
      link.download = `GTA-CHAT-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) { console.error(err); } finally { setIsExporting(false); }
  };

  if (!mounted) return null;

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="min-h-screen bg-[#0b0b0d] text-slate-200 selection:bg-indigo-600/30 font-sans pb-20">
        
        <nav className="border-b border-white/5 bg-[#0f0f12]/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <Wand2 size={22} className="text-white" />
              </div>
              <div>
                <span className="font-black italic tracking-tighter text-xl block leading-none text-white">GTA CHATLOG</span>
                <span className="text-[10px] uppercase tracking-[0.3em] text-indigo-400 font-bold">Generator V6</span>
              </div>
            </div>
            <button onClick={handleExport} disabled={isExporting} className="bg-indigo-600 hover:bg-indigo-500 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-indigo-600/20 text-white">
              {isExporting ? <RotateCcw size={18} className="animate-spin" /> : <Download size={18} />} POBIERZ PNG
            </button>
          </div>
        </nav>

        <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
          
          <div className="lg:col-span-2 space-y-8">
            {/* EDYTOR */}
            <section className="bg-[#111114] rounded-[32px] border border-white/5 p-8 shadow-2xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <AlignLeft size={18} className="text-indigo-400" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Edytor Treści</h2>
                </div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Wpisz <span className="text-indigo-400">/</span> aby wybrać gracza
                </div>
              </div>

              <Toolbar editorConfig={initialConfig} />

              <div className="relative min-h-[300px] bg-black/30 rounded-3xl border border-white/5 p-6 focus-within:ring-2 ring-indigo-500/20 transition-all preview-engine-root">
                <RichTextPlugin
                  contentEditable={<ContentEditable className="outline-none min-h-[300px] text-base leading-relaxed" />}
                  placeholder={<div className="absolute top-6 left-6 opacity-25 italic pointer-events-none">Tutaj wpisz treść lub użyj "/"...</div>}
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <PreviewPlugin onHTMLChange={setPreviewHTML} />
                <SlashCommandPlugin players={players} />
              </div>
            </section>

            {/* PODGLĄD */}
            <section className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Monitor size={18} className="text-emerald-500" />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Podgląd Finalny</h2>
                </div>
              </div>

              <div className={cn("rounded-[30px] transition-all relative p-1 overflow-hidden", settings.bgOn ? "bg-black" : "bg-slate-900 border-4 border-dashed border-white/10")}>
                <div ref={chatRef} style={{ 
                  fontFamily: settings.font, fontSize: `${settings.fontSize}px`, 
                  lineHeight: settings.lineHeight, padding: `${settings.padding}px`,
                  backgroundColor: settings.bgOn ? 'black' : 'transparent',
                  filter: `brightness(${settings.brightness}%)`, minHeight: '300px'
                }} className="w-full relative">
                  <div className={cn("relative z-10 preview-engine-root", !settings.showNames && "hide-names-mode")} dangerouslySetInnerHTML={{ __html: previewHTML }} />
                </div>
              </div>
            </section>
          </div>

          {/* SIDEBAR - USTAWIENIA I GRACZE */}
          <div className="space-y-6">
            {/* ZARZĄDZANIE GRACZAMI */}
            <section className="bg-[#111114] rounded-[24px] border border-white/5 p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <Users size={18} className="text-indigo-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Lista Graczy</h2>
              </div>
              
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" value={newPlayer} 
                  onChange={(e) => setNewPlayer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                  placeholder="Imię_Nazwisko"
                  className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 ring-indigo-500"
                />
                <button onClick={addPlayer} className="p-2 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition">
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {players.map(p => (
                  <div key={p} className="flex items-center justify-between bg-white/5 px-3 py-2 rounded-lg group">
                    <span className="text-sm font-medium">{p}</span>
                    <button onClick={() => removePlayer(p)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {players.length === 0 && <div className="text-[10px] text-slate-500 text-center py-4 uppercase font-bold tracking-tighter">Brak dodanych graczy</div>}
              </div>
            </section>

            {/* SUWAKI */}
            <section className="bg-[#111114] rounded-[24px] border border-white/5 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 font-black uppercase text-[10px] text-slate-400 tracking-widest"><Settings2 size={18} className="text-indigo-400" /> Konfiguracja</div>
                <button onClick={resetToDefaults} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-indigo-400 transition" title="Przywróć domyślne"><RefreshCcw size={16} /></button>
              </div>
              {[
                { label: "Wielkość", val: settings.fontSize, min: 10, max: 32, key: "fontSize" },
                { label: "Kontur", val: settings.shadowDepth, min: 0, max: 4, step: 0.1, key: "shadowDepth" },
                { label: "Jasność", val: settings.brightness, min: 50, max: 150, key: "brightness" }
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase"><span>{item.label}</span><span className="text-indigo-400">{item.val}</span></div>
                  <input type="range" min={item.min} max={item.max} step={item.step || 1} value={item.val} onChange={(e) => setSettings({...settings, [item.key]: Number(e.target.value)})} className="w-full accent-indigo-500 h-1 bg-white/5 rounded-lg appearance-none cursor-pointer" />
                </div>
              ))}
              <div className="pt-4 space-y-2">
                <button onClick={() => setSettings({...settings, bgOn: !settings.bgOn})} className={cn("w-full py-2.5 rounded-xl text-[10px] font-black transition-all border uppercase flex items-center justify-center gap-2", settings.bgOn ? "bg-indigo-600/10 border-indigo-600/20 text-indigo-400" : "bg-white/5 border-white/5 text-slate-500")}><Layers size={14} /> Tło: {settings.bgOn ? "Czarne" : "Brak"}</button>
                <button onClick={() => setSettings({...settings, showNames: !settings.showNames})} className={cn("w-full py-2.5 rounded-xl text-[10px] font-black transition-all border uppercase flex items-center justify-center gap-2", settings.showNames ? "bg-emerald-600/10 border-emerald-600/20 text-emerald-400" : "bg-red-600/10 border-red-600/20 text-red-400")}>{settings.showNames ? <UserCheck size={14} /> : <UserX size={14} />} Imiona: {settings.showNames ? "Pokaż" : "Ukryj"}</button>
              </div>
            </section>
          </div>
        </main>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .gta-paragraph {
          margin: 0; padding: 0; word-break: break-word; color: white;
          font-weight: 500;
          text-shadow: 
            ${settings.shadowDepth}px ${settings.shadowDepth}px 0 #000,
            -${settings.shadowDepth}px -${settings.shadowDepth}px 0 #000,
            ${settings.shadowDepth}px -${settings.shadowDepth}px 0 #000,
            -${settings.shadowDepth}px ${settings.shadowDepth}px 0 #000;
        }

        /* NAPRAWA: Usunięcie font-style: normal z bolda */
        .preview-engine-root .lexical-bold, 
        .preview-engine-root strong {
          font-weight: 900 !important;
        }

        .preview-engine-root .lexical-italic,
        .preview-engine-root em {
          font-style: italic !important;
        }

        .chat-name-prefix { font-weight: 900; }
        .hide-names-mode .chat-name-prefix { display: none; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </LexicalComposer>
  );
}

// --- KOMPONENT TOOLBAR ---
function Toolbar({ editorConfig }: { editorConfig: any }) {
  const [editor] = useLexicalComposerContext();
  const applyColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color });
      }
    });
  };

  return (
    <div className="flex flex-wrap gap-4 items-center justify-between mb-6 bg-black/40 p-3 rounded-2xl border border-white/5">
      <div className="flex gap-1.5 bg-black/20 p-1.5 rounded-xl border border-white/5">
        {["#C2A2DA", "#3399FF", "#33FF33", "#FFFF66", "#FF3333", "#FFFFFF"].map((color) => (
          <button key={color} onClick={() => applyColor(color)} className="w-6 h-6 rounded-md border border-white/10" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="flex gap-1">
        <button onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"><Bold size={18} /></button>
        <button onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"><Italic size={18} /></button>
        <button onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} className="ml-4 p-2 text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 size={18} /></button>
      </div>
    </div>
  );
}