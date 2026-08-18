import { ReactNode } from 'react';

import TopBar from '../../components/layout/TopBar';

// Layout.css intentionally not imported — the pre-redo styles it
// contained (`.layout`, `.page__body`, `.bottom-bar__container`) don't
// match any element we render anymore.

interface LayoutProps {
  showNav?: boolean;
  children: ReactNode;
  className?: string;
  noHeightLimit?: boolean;
}

/**
 * Every page wraps its content in <Layout>. Previously that meant the
 * MUI-based LeftNav sidebar + a bottom bar; now it's fancy webatrice's
 * TopBar sitting above a flexible content area. Underneath, react-
 * router is still the source of truth for navigation — the TopBar just
 * shows joined rooms / joined games / transient routes as tabs.
 */
function Layout({ children, className, showNav = true, noHeightLimit = false }: LayoutProps) {
  return (
    <div className={['flex h-full flex-col bg-bg-base', noHeightLimit ? '' : 'min-h-0'].join(' ')}>
      {showNav && <TopBar />}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full ${className ?? ''}`}>{children}</div>
      </main>
    </div>
  );
}

export default Layout;
