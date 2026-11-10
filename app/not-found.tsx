import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
      <h2 className="text-[24px] font-bold text-ink">Page Not Found</h2>
      <p className="mt-2 text-[14px] text-ink2">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-5 rounded-full bg-brand px-5 py-2.5 text-[14px] font-semibold text-on-brand shadow-xs hover:opacity-95 transition-opacity"
      >
        Go Back Home
      </Link>
    </div>
  );
}

