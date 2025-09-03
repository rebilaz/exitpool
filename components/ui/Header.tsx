'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useScrollCompact } from '@/hooks/useScrollCompact';
import * as MobileNavMod from './MobileNav';
import * as UserMenuMod from './UserMenu';
const MobileNav = (MobileNavMod as any).default ?? (MobileNavMod as any).MobileNav;
const UserMenu = (UserMenuMod as any).default ?? (UserMenuMod as any).UserMenu;

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord' },
  { href: '/portfolio', label: 'Portefeuille' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/insights', label: 'Insights' },
];

export default function Header() {
  const pathname = usePathname();
  const isCompact = useScrollCompact(24);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  return (
    // Backplate blanc COLLÉ en haut (plus de bande noire)
    <div className="sticky top-0 z-40 w-full bg-white">
      {/* on recrée le décalage visuel avec un padding interne */}
      <div className="px-2 sm:px-4 pt-2">
        {/* Carte flottante */}
        <header
          data-compact={isCompact ? 'true' : 'false'}
          className={[
            'mx-auto max-w-7xl rounded-2xl border bg-white/90 backdrop-blur-xl',
            'border-neutral-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)]',
            'transition-[height,background,box-shadow] duration-200',
            isCompact ? 'h-12' : 'h-16',
            'motion-reduce:transition-none',
          ].join(' ')}
          style={{ willChange: 'height, background, box-shadow' }}
        >
          <div className="flex h-full items-center gap-3 px-3 sm:px-4">
            {/* Marque */}
            <Link
              href="/"
              className="rounded-lg px-2 py-1 text-sm font-semibold tracking-tight text-neutral-900 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
            >
              CryptoPilot
            </Link>

            {/* Nav desktop */}
            <nav
              role="navigation"
              aria-label="Navigation principale"
              className="mx-auto hidden md:flex items-center gap-1"
            >
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'rounded-xl px-3 py-2 text-sm transition',
                      'text-neutral-900 hover:bg-neutral-100',
                      active ? 'underline underline-offset-4' : '',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/transactions/new"
                className="hidden sm:inline-flex items-center rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 text-neutral-900"
              >
                + Ajouter transaction
              </Link>

              {MobileNav ? <MobileNav /> : null}

              {isAuthenticated ? (
                UserMenu ? <UserMenu /> : null
              ) : (
                <Link
                  href="/api/auth/signin"
                  className="rounded-xl px-3 py-2 text-sm border border-neutral-300 hover:bg-neutral-50 text-neutral-900"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </header>
      </div>
    </div>
  );
}
