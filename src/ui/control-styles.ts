import styles from './styles';

type ControlVariant = 'primary' | 'secondary' | 'danger';
type ControlSize = 'default' | 'compact';

interface ControlStyleOptions {
  variant?: ControlVariant;
  size?: ControlSize;
  block?: boolean;
  link?: boolean;
  copied?: boolean;
}

export function controlClass({
  variant = 'primary',
  size = 'default',
  block = false,
  link = false,
  copied = false,
}: ControlStyleOptions = {}): string {
  return [
    styles.button,
    variant === 'secondary' && styles.secondary,
    variant === 'danger' && styles.danger,
    size === 'compact' && styles.compact,
    block && styles.buttonWide,
    link && styles.linkButton,
    copied && styles.copied,
  ]
    .filter(Boolean)
    .join(' ');
}
