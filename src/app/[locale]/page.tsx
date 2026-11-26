import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '../../features/i18n/LanguageSwitcher';
import { ThemeToggle } from '../../features/theme/ThemeToggle';

export default async function Home() {
  const t = await getTranslations('home');
  return (
    <main className="p-4">
      <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
      <div className="flex flex-wrap gap-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </main>
  );
}
