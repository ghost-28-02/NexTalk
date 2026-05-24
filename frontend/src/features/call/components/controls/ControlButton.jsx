import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Reusable circular control button used across all call screens.
 *
 * @param {object} props
 * @param {React.ElementType} props.icon  Lucide icon component
 * @param {string}  [props.label]         Optional label rendered below the button
 * @param {boolean} [props.isActive]      Highlights the button (muted, video off, etc.)
 * @param {boolean} [props.isDestructive] Red destructive style (end call)
 * @param {boolean} [props.dark]          White-on-dark style for video overlay
 */
export function ControlButton({
  icon: Icon,
  label,
  isActive = false,
  isDestructive = false,
  onClick,
  dark = false,
  className,
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Button
        variant={isDestructive ? 'destructive' : isActive ? 'secondary' : 'ghost'}
        size="lg"
        className={cn(
          'h-14 w-14 rounded-full',
          dark && !isActive && !isDestructive && 'bg-white/20 hover:bg-white/30 text-white',
          className,
        )}
        onClick={onClick}
      >
        <Icon className="h-6 w-6" />
      </Button>
      {label && (
        <span
          className={cn(
            'text-xs font-medium',
            dark ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
