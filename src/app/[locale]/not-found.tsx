import { getTranslations } from 'next-intl/server';
import { BackLink } from '../../features/library';

// A tree address that is not in the catalog (an unknown or unpublished slug). Story 5.2 widens this to the
// friendly page for every missing link and search; for now it names the problem and leads one level up.
// An unsupported language (/fr) never gets here: `proxy.ts` sends it to the global 404.
export default async function LocaleNotFound() {
  const t = await getTranslations('library');
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-4" data-not-found="">
      <h1 className="m-0 text-3xl font-bold">{t('notFoundTitle')}</h1>
      <p className="m-0">{t('notFoundBody')}</p>
      <BackLink />
    </main>
  );
}
