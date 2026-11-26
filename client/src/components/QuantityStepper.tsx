import { Minus, Plus } from 'lucide-react';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Qué se suma o resta, para los lectores de pantalla ("Agregar Cheddar extra"). */
  label: string;
  disabled?: boolean;
};

const buttonClass =
  'grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-bone focus-visible:outline-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-35';

export function QuantityStepper({ value, onChange, min, max, label, disabled = false }: Props) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white">
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Quitar ${label}`}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Agregar ${label}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
