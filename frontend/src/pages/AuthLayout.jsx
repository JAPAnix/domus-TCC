import BrandLogo from '../components/BrandLogo';
import { Card } from '../components/ui';

/** Moldura das telas de entrada na conta. */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <BrandLogo className="mx-auto mb-6" />
        <Card className="sm:p-8">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-6 text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </main>
  );
}
