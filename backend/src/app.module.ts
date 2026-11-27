import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module.js';
import { AccessModule } from './modules/access/access.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { CredentialsModule } from './modules/credentials/credentials.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OrganisationTypesModule } from './modules/organisation-types/organisation-types.module.js';
import { WorksModule } from './modules/works/works.module.js';
import { OrganizationModule } from './modules/organization/organization.module.js';
import { PeopleModule } from './modules/people/people.module.js';
import { StaffModule } from './modules/staff/staff.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { UserModule } from './modules/user/user.module.js';

@Module({
  imports: [
    CoreModule,
    HealthModule,
    TenantModule,
    UserModule,
    AuditModule,
    AccessModule,
    OrganizationModule,
    AuthModule,
    CredentialsModule,
    ClientsModule,
    OrganisationTypesModule,
    WorksModule,
    StaffModule,
    PeopleModule,
  ],
})
export class AppModule {}
