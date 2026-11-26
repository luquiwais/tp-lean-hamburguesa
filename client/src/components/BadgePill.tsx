import { Flame, Leaf, Sparkles, Star, WheatOff, type LucideIcon } from 'lucide-react';
import type { Badge } from '@burger/shared';

const BADGES: Record<Badge, { label: string; Icon: LucideIcon; className: string }> = {
  nuevo: { label: 'Nuevo', Icon: Sparkles, className: 'bg-accent-600 text-white' },
  picante: { label: 'Picante', Icon: Flame, className: 'bg-accent-600/10 text-accent-700' },
  veggie: { label: 'Veggie', Icon: Leaf, className: 'bg-brand-50 text-brand-700' },
  sin_tacc: { label: 'Sin TACC', Icon: WheatOff, className: 'bg-bone text-ink' },
  popular: { label: 'Popular', Icon: Star, className: 'bg-brand-600 text-white' },
};

export function BadgePill({ badge }: { badge: Badge }) {
  const { label, Icon, className } = BADGES[badge];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
