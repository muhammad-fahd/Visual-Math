'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';

// "Back" for a page that found nothing: one level up the address (the chapter's subcategory, a category's home),
// so a mistyped slug leads somewhere real instead of a dead end. The locale itself is the last stop, the home page.
export function BackLink() {
  const t = useTranslations('library');
  const parts = usePathname().split('/').filter(Boolean);
  const up = `/${parts.slice(0, Math.max(1, parts.length - 1)).join('/')}`;
  return (
    <Link href={up} className="inline-flex min-h-11 items-center text-link underline" data-back-link="">
      {parts.length > 1 ? t('backToParent') : t('home')}
    </Link>
  );
}
