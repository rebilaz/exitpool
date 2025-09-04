"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur / Escape
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "authenticated") {
    return (
      <a
        href="/api/auth/signin"
        className="text-sm font-medium text-neutral-800 rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-50"
      >
        Login
      </a>
    );
  }

  const getInitials = (name?: string | null) =>
    (name ?? "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="
          inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full
          p-0 leading-none align-middle
          bg-neutral-200 text-neutral-900
          outline-none focus:outline-none
          focus-visible:ring-2 focus-visible:ring-blue-500
          focus-visible:ring-offset-2 focus-visible:ring-offset-white
          dark:focus-visible:ring-offset-neutral-900
          transition-shadow
        "
      >
        {/* Avatar image ou fallback initiales */}
        {session.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user?.name ?? "User avatar"}
            className="block h-10 w-10 rounded-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-sm font-semibold leading-none select-none">
            {getInitials(session.user?.name)}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-xl dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 z-50"
        >
          <button
            role="menuitem"
            className="block w-full px-4 py-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => setOpen(false)}
          >
            Profile
          </button>
          <button
            role="menuitem"
            className="block w-full px-4 py-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => setOpen(false)}
          >
            Settings
          </button>
          <button
            role="menuitem"
            className="block w-full px-4 py-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
