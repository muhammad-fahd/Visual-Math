import type { ReactNode } from 'react';
import { requireAdminPage } from '../../../server/admin';

export const dynamic = 'force-dynamic';

// A first gate. Layouts do not re-run on client navigation, so every page below checks again.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  await requireAdminPage();
  return children;
}
