import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { SessionService } from '../../../core/auth/session.service';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { Position } from '../domain/admin.models';
import { DirectoryRepository } from '../domain/directory.repository';
import {
  ConfirmDialog,
  ConfirmDialogData,
  NameDialog,
  NameDialogData,
  PositionDialog,
  PositionDialogData,
} from './admin-dialogs';
import { ResetDemoButton } from './reset-demo-button';

interface OrgNode {
  position: Position;
  department: string;
  children: OrgNode[];
}

@Component({
  selector: 'app-organization-page',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    PageHeader,
    ResetDemoButton,
  ],
  templateUrl: './organization-page.html',
  styleUrl: './organization-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationPage {
  private readonly repo = inject(DirectoryRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(SessionService);

  protected readonly canCreate = this.session.can('organization.create');
  protected readonly canEdit = this.session.can('organization.edit');
  protected readonly departments = this.repo.departments;

  protected readonly roots = computed<OrgNode[]>(() => {
    const positions = this.repo.positions();
    const depts = new Map(this.repo.departments().map((d) => [d.id, d.name]));
    const build = (parentId: string | null): OrgNode[] =>
      positions
        .filter((p) => p.parentId === parentId)
        .map((position) => ({
          position,
          department: depts.get(position.departmentId) ?? '—',
          children: build(position.id),
        }));
    return build(null);
  });

  protected addPosition(parentId: string | null): void {
    this.openPosition({ title: 'Add position', parentId }, (value) => this.repo.addPosition(value));
  }

  protected editPosition(position: Position, title: string): void {
    this.openPosition({ title, position }, (value) => this.repo.updatePosition(position.id, value));
  }

  protected removePosition(position: Position): void {
    this.confirm(
      {
        title: `Remove "${position.title}"?`,
        message: 'The position must have no reports and no users.',
        confirmLabel: 'Remove',
      },
      () => this.repo.removePosition(position.id),
    );
  }

  protected addDepartment(): void {
    this.askName(
      { title: 'Add department', label: 'Department name', confirmLabel: 'Add' },
      (name) => this.repo.addDepartment(name),
    );
  }

  protected renameDepartment(id: string, current: string): void {
    this.askName({ title: 'Rename department', label: 'Department name', value: current }, (name) =>
      this.repo.renameDepartment(id, name),
    );
  }

  protected removeDepartment(id: string, name: string): void {
    this.confirm(
      {
        title: `Remove "${name}"?`,
        message: 'The department must have no positions.',
        confirmLabel: 'Remove',
      },
      () => this.repo.removeDepartment(id),
    );
  }

  private openPosition(
    extra: Pick<PositionDialogData, 'title' | 'position' | 'parentId'>,
    save: (value: Omit<Position, 'id'>) => Observable<void>,
  ): void {
    const position = extra.position;
    const data: PositionDialogData = {
      ...extra,
      departments: this.repo.departments(),
      roles: this.repo.roles(),
      positions: this.repo.positions(),
      excludedParents: position ? [position.id, ...this.descendants(position.id)] : [],
    };
    this.dialog
      .open(PositionDialog, { data })
      .afterClosed()
      .subscribe((value?: Omit<Position, 'id'>) => value && this.apply(save(value)));
  }

  private askName(data: NameDialogData, save: (name: string) => Observable<void>): void {
    this.dialog
      .open(NameDialog, { data })
      .afterClosed()
      .subscribe((name?: string) => name && this.apply(save(name)));
  }

  private confirm(data: ConfirmDialogData, action: () => Observable<void>): void {
    this.dialog
      .open(ConfirmDialog, { data })
      .afterClosed()
      .subscribe((ok?: boolean) => ok && this.apply(action()));
  }

  private apply(change: Observable<void>): void {
    change.subscribe({
      next: () => this.snackBar.open('Saved', 'OK', { duration: 2000 }),
      error: (e: Error) => this.snackBar.open(e.message, 'OK', { duration: 6000 }),
    });
  }

  private descendants(id: string): string[] {
    const positions = this.repo.positions();
    const found: string[] = [];
    const walk = (parent: string): void => {
      for (const p of positions) {
        if (p.parentId === parent) {
          found.push(p.id);
          walk(p.id);
        }
      }
    };
    walk(id);
    return found;
  }
}
