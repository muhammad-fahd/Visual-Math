import { adminText } from '../../i18n/messages/admin';

// What a visitor, a password-only session or a non-admin sees for any admin page: the same
// page every time, with no hint that an admin area exists (AD-8).
export default function AdminNotAvailable() {
  return (
    <main className="p-4">
      <h1 className="mb-2 text-2xl font-bold">{adminText.notAvailable.title}</h1>
      <p>{adminText.notAvailable.body}</p>
    </main>
  );
}
