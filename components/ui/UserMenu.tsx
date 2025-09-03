"use client";

import React from 'react';
import { useSession, signOut } from 'next-auth/react';

// Assuming you have shadcn/ui components available
// You would typically install them via `npx shadcn-ui@latest add dropdown-menu avatar button`
// For now, let's create placeholder components if they don't exist.

// Placeholder for DropdownMenu components
const DropdownMenu = ({ children }: { children: React.ReactNode }) => <div className="relative inline-block text-left">{children}</div>;
const DropdownMenuTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => asChild ? <>{children}</> : <button>{children}</button>;
const DropdownMenuContent = ({ children, align }: { children: React.ReactNode; align?: string }) => <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-neutral-800 ring-1 ring-black ring-opacity-5 focus:outline-none">{children}</div>;
const DropdownMenuItem = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => onClick ? <button onClick={onClick} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700">{children}</button> : <a href="#" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700">{children}</a>;
const DropdownMenuSeparator = () => <hr className="border-gray-200 dark:border-neutral-700" />;

// Placeholder for Avatar components
const Avatar = ({ children }: { children: React.ReactNode }) => <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-neutral-700 flex items-center justify-center">{children}</div>;
const AvatarImage = ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} className="w-full h-full rounded-full" />;
const AvatarFallback = ({ children }: { children: React.ReactNode }) => <span className="text-gray-600 dark:text-gray-300 font-medium">{children}</span>;

// Placeholder for Button component
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${className}`}
      {...props}
    />
  )
);
Button.displayName = 'Button';


export function UserMenu() {
  const { data: session, status } = useSession();

  if (status !== 'authenticated') {
    return (
      <Button
        className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 rounded-md"
      >
        Login
      </Button>
    );
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="relative h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-neutral-900">
          <Avatar>
            {session.user?.image ? (
              <AvatarImage src={session.user.image} alt={session.user.name ?? 'User avatar'} />
            ) : (
              <AvatarFallback>{session.user?.name ? getInitials(session.user.name) : 'U'}</AvatarFallback>
            )}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
