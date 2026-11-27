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
import { toApiError } from '../../../core/http/api-error';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { loadedState } from '../../../shared/utils/loaded';
import { Department, Position } from '../domain/admin.models';
import { OrganizationRepository } from '../domain/organization.repository';
import {
  DepartmentDialog,
  DepartmentDialogResult,
  PositionDialog,
  PositionDialogData,
  PositionDialogResult,
} from './admin-dialogs';

interface OrgNode {
  position: Position;
  department: string;
  children: OrgNode[];
}

/**
 * The organization chart: positions (the reporting hierarchy) and departments. Positions and
 * departments are created and edited, never deleted. The server keeps codes unique and prevents
 * a position from becoming its own descendant.
 */
@Component({
  selector: 'app-organization-page',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    PageHeader,
  ],
  templateUrl: './organization-page.html',
  styleUrl: './organization-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationPage {
  private readonly repo = inject(OrganizationRepository);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly session = inject(SessionService);

  protected readonly canCreate = this.session.can('organization.create');
  protected readonly canEdit = this.session.can('organization.edit');

  private readonly departmentList = loadedState(() => this.repo.departments());
  private readonly positionList = loadedState(() => this.repo.positions());
  private readonly roleList = loadedState(() => this.repo.roles());

  protected readonly departments = computed(() => this.departmentList.state().rows);
  protected readonly loading = computed(
    () => this.departmentList.state().loading || this.positionList.state().loading,
  );
  protected readonly error = computed(
    () => this.departmentList.state().error ?? this.positionList.state().error,
  );

  protected readonly roots = computed<OrgNode[]>(() => {
    const positions = this.positionList.state().rows;
    const depts = new Map(this.departments().map((d) => [d.id, d.name]));
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
    this.openPosition({ title: 'Add position', parentId }, (r) =>
      this.repo.addPosition({ ...r.input, code: r.code ?? '' }),
    );
  }

  protected editPosition(position: Position, title: string): void {
    this.openPosition({ title, position }, (r) => this.repo.updatePosition(position.id, r.input));
  }

  protected addDepartment(): void {
    this.openDepartment({ title: 'Add department' }, (r) =>
      this.repo.addDepartment({ ...r.input, code: r.code ?? '' }),
    );
  }

  protected editDepartment(department: Department): void {
    this.openDepartment({ title: 'Edit department', department }, (r) =>
      this.repo.updateDepartment(department.id, r.input),
    );
  }

  private openPosition(
    extra: Pick<PositionDialogData, 'title' | 'position' | 'parentId'>,
    save: (result: PositionDialogResult) => Observable<unknown>,
  ): void {
    const position = extra.position;
    const data: PositionDialogData = {
      ...extra,
      departments: this.departmentList.state().rows,
      roles: this.roleList.state().rows,
      positions: this.positionList.state().rows,
      excludedParents: position ? [position.id, ...this.descendants(position.id)] : [],
    };
    this.dialog
      .open(PositionDialog, { data })
      .afterClosed()
      .subscribe((result?: PositionDialogResult) => result && this.apply(save(result)));
  }

  private openDepartment(
    data: { title: string; department?: Department },
    save: (result: DepartmentDialogResult) => Observable<unknown>,
  ): void {
    this.dialog
      .open(DepartmentDialog, { data })
      .afterClosed()
      .subscribe((result?: DepartmentDialogResult) => result && this.apply(save(result)));
  }

  private apply(change: Observable<unknown>): void {
    change.subscribe({
      next: () => {
        this.snackBar.open('Saved', 'OK', { duration: 2000 });
        this.departmentList.reload();
        this.positionList.reload();
      },
      // Duplicate code (409), cycle or unknown reference (400): the server's message is readable.
      error: (e: unknown) => this.snackBar.open(toApiError(e).message, 'OK', { duration: 8000 }),
    });
  }

  private descendants(id: string): string[] {
    const positions = this.positionList.state().rows;
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
