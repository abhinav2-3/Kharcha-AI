import type { AnyCategory } from '@/lib/constants';
import { CATEGORY_META } from '@/lib/meta';

export default function CategoryChip({ category }: { category: AnyCategory }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  const Icon = meta.icon;

  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-tint text-ink"
      aria-hidden="true"
    >
      <Icon size={18} strokeWidth={2.2} />
    </span>
  );
}

