import { ReactNode } from 'react';

import NavRail from './NavRail';
import TopBar from './TopBar';

interface LayoutProps {
  showNav?: boolean;
  children: ReactNode;
  className?: string;
  noHeightLimit?: boolean;
}

function Layout({ children, className, showNav = true, noHeightLimit = false }: LayoutProps) {
  return (
    <div className={['flex h-full bg-bg-base', noHeightLimit ? '' : 'min-h-0'].join(' ')}>
      {showNav && <NavRail />}
      <div className="flex min-w-0 flex-1 flex-col">
        {showNav && <TopBar />}
        <main tabIndex={-1} className="flex-1 min-h-0 overflow-clip">
          <div className={`h-full ${className ?? ''}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
