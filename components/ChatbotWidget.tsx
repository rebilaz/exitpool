"use client";

import React, { useEffect, useState } from "react";
import ChatPanel from "./ChatPanel";

const TOOLBAR_H = 50; // hauteur entête

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isDesktop =
      typeof window !== "undefined"
        ? window.matchMedia("(min-width:1024px)").matches
        : false;
    setOpen(isDesktop);
  }, []);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 border border-gray-200 bg-white rounded-2xl shadow-2xl transition-[height] duration-200`}
      style={{
        width: open ? "420px" : "280px", // widget plus large une fois ouvert
        height: open ? "70vh" : `${TOOLBAR_H}px`, // prend ~70% de la hauteur
      }}
      role="complementary"
      aria-label="Assistant IA"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl"
        style={{ height: TOOLBAR_H }}
      >
        <span className="text-sm font-semibold text-gray-900">Assistant IA</span>

        {/* Bouton flèche */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="chatbot-dock-body"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title={open ? "Replier" : "Déplier"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            className={`transition-transform ${open ? "" : "rotate-180"}`}
            aria-hidden="true"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Corps du chat */}
      <div
        id="chatbot-dock-body"
        className="h-[calc(100%-50px)]"
        style={{ display: open ? "block" : "none" }}
      >
        <ChatPanel />
      </div>
    </div>
  );
}
