'use client';

import { adminText } from '../../i18n/messages/admin';
import { post } from './api';

export function SignOutButton() {
  async function signOut() {
    await post('/api/admin/auth/sign-out', {});
    window.location.assign('/admin/sign-in');
  }
  return (
    <button type="button" onClick={signOut} className="min-h-11 rounded-md border-2 border-border-strong bg-surface px-4 font-semibold text-text">
      {adminText.panel.signOut}
    </button>
  );
}
