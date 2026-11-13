import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '../../../shared/components/page-header/page-header';

/** Works master: placeholder until the database-backed master is built. */
@Component({
  selector: 'app-works-page',
  imports: [PageHeader],
  template: `<app-page-header title="Works" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorksPage {}
