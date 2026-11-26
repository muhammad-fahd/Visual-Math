import { ThemeToggle } from '../features/theme/ThemeToggle';

export default function Home() {
  return (
    <main className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Visual Math</h1>
      <ThemeToggle />
    </main>
  );
}
