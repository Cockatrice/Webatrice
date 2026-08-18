import { AuthGuard } from '@app/components';
import { ShortcutsTab } from '@app/feature-widgets/shortcuts';
import { Layout } from '@app/feature-wrappers/layout';

/**
 * Dedicated Shortcuts page opened from the account menu. Reuses the
 * `ShortcutsTab` widget so the reference list, search, and rebind
 * flow stay in one place (also mounted inside Settings). Layout gives
 * us a bounded parent (`h-full min-h-0 overflow-hidden`); the inner
 * scroller needs its own `flex-1 min-h-0 overflow-y-auto` so long
 * lists of shortcuts overflow into scroll instead of clipping.
 */
export default function Shortcuts() {
  return (
    <Layout className="shortcuts-page">
      <AuthGuard />
      <div className="h-full flex flex-col overflow-hidden">
        <div className="scrollable flex-1 min-h-0 overflow-y-auto p-4">
          <ShortcutsTab />
        </div>
      </div>
    </Layout>
  );
}
