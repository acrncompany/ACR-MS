import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

// Only the ECharts pieces the app uses (keeps the bundle small).
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export type ChartOption = echarts.EChartsCoreOption;

/** Thin ECharts wrapper: renders `option`, resizes with its container, disposes on destroy. */
@Component({
  selector: 'app-chart',
  template: '<div #host class="host"></div>',
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .host {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chart {
  readonly option = input.required<ChartOption>();
  readonly height = input('16rem');

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private chart?: echarts.ECharts;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const element = this.host().nativeElement;
      element.style.height = this.height();
      this.chart = echarts.init(element);
      this.chart.setOption(this.option());

      const observer = new ResizeObserver(() => this.chart?.resize());
      observer.observe(element);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        this.chart?.dispose();
      });
    });

    effect(() => {
      const option = this.option();
      this.chart?.setOption(option, true);
    });
  }
}
