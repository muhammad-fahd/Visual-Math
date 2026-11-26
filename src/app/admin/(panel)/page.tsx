import { SignOutButton } from '../../../features/admin/SignOutButton';
import { adminText, fill } from '../../../i18n/messages/admin';
import { requireAdminPage } from '../../../server/admin';

export const dynamic = 'force-dynamic';

export default async function AdminPanel() {
  const admin = await requireAdminPage();
  return (
    <main className="p-4">
      <h1 className="mb-2 text-2xl font-bold">{adminText.panel.heading}</h1>
      <p className="mb-4">{fill(adminText.panel.signedIn, { email: admin.email })}</p>
      <SignOutButton />
    </main>
  );
}
