export interface ChartColors {
  primary: string;
  secondary: string;
  tertiary: string;
  soft: string;
  warn: string;
  danger: string;
  text: string;
  muted: string;
  grid: string;
  surface: string;
}

/**
 * Reads the current theme's colours so charts follow light/dark and tenant branding.
 *
 * Custom properties that hold `light-dark(...)` come back unresolved from getPropertyValue(),
 * so each one is resolved by letting the browser compute `color` on a hidden probe element.
 */
export function readChartColors(): ChartColors {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.documentElement.appendChild(probe);

  const resolve = (variable: string): string => {
    probe.style.color = '';
    probe.style.color = `var(${variable})`;
    return getComputedStyle(probe).color;
  };

  try {
    return {
      primary: resolve('--chart-1'),
      secondary: resolve('--chart-2'),
      tertiary: resolve('--chart-3'),
      soft: resolve('--chart-4'),
      warn: resolve('--chart-warn'),
      danger: resolve('--mat-sys-error'),
      text: resolve('--mat-sys-on-surface'),
      muted: resolve('--mat-sys-on-surface-variant'),
      grid: resolve('--mat-sys-outline-variant'),
      surface: resolve('--mat-sys-surface-container-lowest'),
    };
  } finally {
    probe.remove();
  }
}
