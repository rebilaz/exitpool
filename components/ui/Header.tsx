'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useScrollCompact } from '@/hooks/useScrollCompact';
import dynamic from 'next/dynamic';
import * as MobileNavMod from './MobileNav';
import * as UserMenuMod from './UserMenu';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Formulaire chargé côté client uniquement
const TransactionForm = dynamic(
  () => import('@/components/ui/TransactionForm'),
  { ssr: false }
);

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
  const router = useRouter();
  const isCompact = useScrollCompact(24);
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [showAdd, setShowAdd] = useState(false);
  const [qc] = useState(() => new QueryClient());

  // Migration auto des transactions au login
  useEffect(() => {
    if (status !== 'authenticated') return;

    const tempId =
      typeof window !== 'undefined'
        ? localStorage.getItem('cp_temp_user_id')
        : null;
    if (!tempId) return;

    (async () => {
      try {
        const res = await fetch('/api/users/migrate-temp-transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tempUserId: tempId }),
        });

        if (res.ok) {
          localStorage.removeItem('cp_temp_user_id');
          router.refresh();
        } else {
          console.warn('[migration] API responded with error', res.status);
        }
      } catch (e) {
        console.warn('[migration] failed', e);
      }
    })();
  }, [status, router]);

  return (
    <div className="sticky top-0 z-40 w-full bg-white">
      <div className="px-2 sm:px-4 pt-2">
        <header
          data-compact={isCompact ? 'true' : 'false'}
          className={[
            'mx-auto max-w-7xl rounded-2xl border bg-white/90 backdrop-blur-xl',
            'border-neutral-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)]',
            'transition-[height,background,box-shadow] duration-200',
            isCompact
              ? 'h-12 data-[compact=true]:bg-white/85 data-[compact=true]:shadow-[0_6px_18px_-10px_rgba(0,0,0,.25)]'
              : 'h-16',
            'motion-reduce:transition-none',
          ].join(' ')}
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
              className="mx-auto hidden md:flex items-center gap-1 max-w-[640px] overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]"
            >
              <style jsx>{`
                nav::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {navItems.map((item) => {
                const active =
                  pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                      active
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              {/* CTA principal */}
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="hidden sm:inline-flex h-10 items-center rounded-xl bg-black px-3 text-sm font-semibold text-white hover:bg-neutral-900 active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                + Ajouter transaction
              </button>

              {MobileNav ? <MobileNav /> : null}

              {/* Avatar / état session */}
              {status === 'loading' ? (
                <div
                  className="h-10 w-10 rounded-full bg-neutral-200 animate-pulse"
                  aria-hidden
                />
              ) : isAuthenticated ? (
                <div className="flex h-10 items-center">
                  {UserMenu ? <UserMenu /> : null}
                </div>
              ) : (
                <Link
                  href="/api/auth/signin"
                  className="rounded-xl px-3 py-2 text-sm border border-neutral-300 text-neutral-900 hover:bg-neutral-50 active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Transaction Form */}
      {showAdd && (
        <QueryClientProvider client={qc}>
          <TransactionForm
            userId={session?.user?.id}
            isOpen={showAdd}
            onClose={() => setShowAdd(false)}
          />
        </QueryClientProvider>
      )}
    </div>
  );
}
