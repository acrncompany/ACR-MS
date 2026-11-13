import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Tiny trend line. Colour comes from the CSS `color` of the host. */
@Component({
  selector: 'app-sparkline',
  template: `
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <path class="area" [attr.d]="area()" />
      <path class="line" [attr.d]="line()" />
    </svg>
  `,
  styles: `
    :host {
      display: block;
      height: 2.25rem;
      color: var(--chart-2);
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .line {
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .area {
      fill: currentColor;
      opacity: 0.12;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sparkline {
  readonly values = input.required<number[]>();

  private readonly points = computed(() => {
    const values = this.values();
    if (values.length < 2) return [];
    const min = Math.min(...values);
    const span = Math.max(...values) - min || 1;
    const step = 100 / (values.length - 1);
    return values.map((v, i) => [i * step, 28 - ((v - min) / span) * 24] as const);
  });

  protected readonly line = computed(() =>
    this.points()
      .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' '),
  );

  protected readonly area = computed(() => {
    const line = this.line();
    return line ? `${line} L100 32 L0 32 Z` : '';
  });
}
