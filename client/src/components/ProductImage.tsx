import { UtensilsCrossed } from 'lucide-react';
import { cn } from 'cn';

type Props = { src: string | null; alt?: string; className?: string; eager?: boolean };

// Foto del producto o, si todavía no tiene, un placeholder neutro.
export function ProductImage({ src, alt = '', className, eager = false }: Props) {
  if (!src) {
    return (
      <div className={cn('grid size-full place-items-center bg-bone text-ink-muted/40', className)}>
        <UtensilsCrossed className="size-1/3 max-h-10 max-w-10" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('size-full object-cover', className)}
    />
  );
}
