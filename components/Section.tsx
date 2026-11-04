import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  aside?: string;
  href?: string;
  pad?: boolean;
  children: ReactNode;
}

export default function Section({ title, aside, href, pad = true, children }: Props) {
  return (
    <section className="mt-7">
      <div className="flex items-center justify-between px-5 pb-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="flex items-center gap-0.5 text-[14px] font-medium text-ink2 hover:text-ink"
          >
            See all <ChevronRight size={16} />
          </Link>
        ) : aside ? (
          <span className="text-[13px] text-ink2">{aside}</span>
        ) : null}
      </div>
      <div className={pad ? 'px-5' : ''}>{children}</div>
    </section>
  );
}

