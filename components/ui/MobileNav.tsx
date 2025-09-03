"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

// Placeholder pour l'icône Menu (hamburger)
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

// Placeholder pour l'icône X (fermeture)
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

// Placeholder pour l'icône Plus
const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/portfolio', label: 'Portefeuille' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/insights', label: 'Insights' },
];

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      {/* Bouton hamburger - visible seulement sur mobile */}
      <button
        className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        onClick={() => setIsOpen(true)}
        aria-label="Ouvrir le menu de navigation"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {/* Overlay et panneau mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay sombre */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={closeMenu}
          />
          
          {/* Panneau coulissant */}
          <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-neutral-900 shadow-xl">
            <div className="flex h-full flex-col">
              {/* Header du panneau */}
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-4 py-4">
                <div className="flex items-center gap-2">
                  <span>🚀</span>
                  <span className="text-lg font-bold">CryptoPilot</span>
                </div>
                <button
                  onClick={closeMenu}
                  className="inline-flex items-center justify-center p-2 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                  aria-label="Fermer le menu"
                >
                  <XIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-4 py-6 space-y-2" role="navigation">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className={cn(
                      "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                      pathname === item.href
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}
                    aria-current={pathname === item.href ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {/* Actions du bas */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 px-4 py-4 space-y-3">
                <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors">
                  <PlusIcon className="h-4 w-4" />
                  Ajouter transaction
                </button>
                {status === 'authenticated' ? (
                  <button 
                    onClick={() => signOut()}
                    className="w-full text-center text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors"
                  >
                    Logout ({session?.user?.name})
                  </button>
                ) : (
                  <Link
                    href="/api/auth/signin"
                    className="w-full text-center text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
