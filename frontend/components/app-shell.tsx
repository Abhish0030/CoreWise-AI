'use client';
import Link from 'next/link';
import { useAuth } from '@/features/auth/use-auth';
import { useTelemetry } from '@/features/functional/use-telemetry';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronRight,
  ChevronsLeft,
  Cpu,
  Menu,
  Search,
  X,
  PanelLeftOpen,
  ArrowUpRight,
} from 'lucide-react';
import { navigation, pages } from '@/lib/navigation';
import { Button } from './ui/button';
import { ThemeSelect } from './theme-select';
import { AccountControls } from '@/features/auth/account-controls';

export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === '/login' || path === '/register' ? (
    <main className="auth-stage">{children}</main>
  ) : (
    <AppShell>{children}</AppShell>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const { live } = useTelemetry(auth.data?.id);
  const path = usePathname();
  const current =
    pages.find((page) => path === `/${page.slug}`) ??
    (path === '/profile' ? { name: 'Your profile' } : pages[0]!);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const searchDialog = useRef<HTMLDialogElement>(null);
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const noticesDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setCollapsed(localStorage.getItem('corewise-sidebar') === 'collapsed');
  }, []);
  function toggleSidebar() {
    setCollapsed((value) => {
      localStorage.setItem('corewise-sidebar', !value ? 'collapsed' : 'expanded');
      return !value;
    });
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchDialog.current?.showModal();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  const nav = (mobile = false) => (
    <>
      <Link
        className="brand"
        href="/"
        onClick={() => mobileDialog.current?.close()}
        aria-label={collapsed && !mobile ? 'CoreWise AI overview' : undefined}
      >
        <span className="brand-icon">
          <Cpu size={24} />
        </span>
        <span className="brand-text">
          <strong>
            CoreWise<span> AI</span>
          </strong>
          <small>HARDWARE INTELLIGENCE</small>
        </span>
      </Link>
      <nav aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}>
        {navigation.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-heading">{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.slug}
                href={`/${item.slug}`}
                className={`nav-link ${path === `/${item.slug}` ? 'active' : ''}`}
                aria-current={path === `/${item.slug}` ? 'page' : undefined}
                aria-label={item.slug === 'ai-assistant' ? `${item.name} AI` : item.name}
                title={item.name}
                onClick={() => mobileDialog.current?.close()}
              >
                <item.icon size={18} />
                <span>{item.name}</span>{' '}
                {item.slug === 'ai-assistant' && (
                  <small className="nav-new" aria-hidden="true">
                    AI
                  </small>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="workspace-avatar">CW</span>
        <span className="brand-text">
          <strong>Local workspace</strong>
          <small>WORKSPACE · M7</small>
        </span>
      </div>
    </>
  );
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        {nav()}
        <Button
          variant="ghost"
          className="collapse-button"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <>
              <ChevronsLeft size={18} />
              <span>Collapse sidebar</span>
            </>
          )}
        </Button>
      </aside>
      <div className="main-wrap">
        <header className="header">
          <div className="breadcrumbs">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => mobileDialog.current?.showModal()}
            >
              <Menu size={20} />
            </Button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current.name}</strong>
          </div>
          <div className="header-actions">
            <button
              className="search-trigger"
              onClick={() => searchDialog.current?.showModal()}
              aria-label="Search pages Ctrl K"
            >
              <Search size={16} />
              <span>Search pages</span> <kbd aria-hidden="true">Ctrl K</kbd>
            </button>
            <span className="connection">
              <i />
              {live ? 'Telemetry online' : 'Telemetry offline'}
            </span>
            <ThemeSelect />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Notifications"
              onClick={() => noticesDialog.current?.showModal()}
            >
              <Bell size={18} />
            </Button>
            <AccountControls />
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="page-footer">
          <span>
            CoreWise AI <span className="footer-separator">/</span> Intelligence Behind Every
            Compute Decision.
          </span>
          <span>WORKSPACE v0.8.0</span>
        </footer>
      </div>
      <dialog ref={mobileDialog} className="mobile-drawer" aria-label="Workspace navigation">
        <div className="dialog-close">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Close navigation"
            onClick={() => mobileDialog.current?.close()}
          >
            <X size={20} />
          </Button>
        </div>
        {nav(true)}
      </dialog>
      <dialog ref={searchDialog} className="search-dialog" aria-labelledby="search-title">
        <div className="dialog-heading">
          <h2 id="search-title">Search workspace</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close search"
            onClick={() => searchDialog.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        <label className="search-input">
          <Search size={18} />
          <input
            autoFocus
            placeholder="Find a page or tool…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search pages"
          />
        </label>
        <div className="search-results">
          {pages
            .filter((page) => page.name.toLowerCase().includes(search.toLowerCase()))
            .map((page) => (
              <Link
                href={`/${page.slug}`}
                key={page.slug}
                onClick={() => searchDialog.current?.close()}
              >
                <page.icon size={18} />
                <span>{page.name}</span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
          {!pages.some((page) => page.name.toLowerCase().includes(search.toLowerCase())) && (
            <p>No pages match “{search}”. Try “hardware” or “settings”.</p>
          )}
        </div>
      </dialog>
      <dialog ref={noticesDialog} className="search-dialog" aria-labelledby="notifications-title">
        <div className="dialog-heading">
          <h2 id="notifications-title">Notifications</h2>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Close notifications"
            onClick={() => noticesDialog.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="notification-empty">
          <Bell size={28} />
          <h3>You’re all caught up</h3>
          <p>There are no notifications in this workspace.</p>
        </div>
      </dialog>
    </div>
  );
}
