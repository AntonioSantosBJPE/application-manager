import { Controller, Get, Module, type DynamicModule, type INestApplication, type Type } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { describe, expect, inject, it } from 'vitest';
import { AppModule } from '../../../app.module.js';
import { createApp } from '../../../create-app.js';
import { ACCESS_KEY, type AccessDeclaration } from './access.decorators.js';
import { AnySession, Public, Roles } from './access.decorators.js';

/** The forms a route may declare: what the failure message offers to whoever forgot one (AUTH-19). */
const acceptedDeclarations = '@Public(), @AnySession() or @Roles(...)';

/** A fixture route with no declaration: the test has to see it and fail naming it. */
@Controller('undeclared-probe')
class UndeclaredProbeController {
  @Get('open')
  open(): string {
    return 'ok';
  }
}

interface RouteAccess {
  route: string;
  declaration: AccessDeclaration | undefined;
}

/**
 * Walks the controllers the application actually registered, so a route added later is inspected
 * without anybody updating a list (AUTH-19). The route is named as `METHOD /path`.
 */
function registeredRoutes(app: INestApplication): RouteAccess[] {
  const discovery = app.get(DiscoveryService, { strict: false });
  const scanner = new MetadataScanner();
  const routes: RouteAccess[] = [];

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    const prefix = Reflect.getMetadata('path', metatype as Type) ?? '';
    if (instance === null || metatype === undefined) continue;

    for (const method of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
      const handler = instance[method as keyof typeof instance] as unknown;
      const path = Reflect.getMetadata('path', handler as object) as string | undefined;
      const httpMethod = Reflect.getMetadata('method', handler as object) as number | undefined;
      if (path === undefined || httpMethod === undefined) continue;

      // The method declaration wins over the controller one (Reflector's own precedence).
      const declaration =
        (Reflect.getMetadata(ACCESS_KEY, handler as object) as AccessDeclaration | undefined) ??
        (Reflect.getMetadata(ACCESS_KEY, metatype as Type) as AccessDeclaration | undefined);
      routes.push({ route: `${requestMethodName(httpMethod)} ${routePath(prefix, path)}`, declaration });
    }
  }
  return routes;
}

/** `/health` for the health root and `/probe/closed` for a nested handler; a lone `/` stays `/`. */
function routePath(prefix: string, path: string): string {
  const joined = [prefix, path]
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return `/${joined}`;
}

/** Express numbers the methods; the number is all Nest stores on the handler. */
function requestMethodName(method: number): string {
  const names = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];
  return names[method] ?? String(method);
}

/** The lines the assertion prints when a route carries no declaration. */
function undeclared(routes: RouteAccess[]): string[] {
  return routes
    .filter((route) => route.declaration === undefined)
    .map((route) => `${route.route} declares no access; accepted: ${acceptedDeclarations}`);
}

const env = {
  webPublicUrl: 'http://localhost:3000',
  sessionCookieSecure: false,
  port: 0,
  logLevel: 'info' as const,
};

function moduleWith(controllers: Type[]): DynamicModule {
  @Module({
    // DiscoveryModule provides DiscoveryService, which walks the controllers of the imported app.
    imports: [AppModule.forRoot({ ...env, databaseUrl: 'postgres://unused:unused@localhost:1/unused' }), DiscoveryModule],
    controllers,
  })
  class FixtureModule {}
  return { module: FixtureModule };
}

/** The real application, wrapped so the discovery service is available to the scan. */
function appWithDiscovery(databaseUrl: string): DynamicModule {
  @Module({ imports: [AppModule.forRoot({ ...env, databaseUrl }), DiscoveryModule] })
  class ObservedModule {}
  return { module: ObservedModule };
}

describe('route access', () => {
  it('every registered route declares access and an undeclared fixture is named in the failure', async () => {
    // Control: the real application passes, so the rule is not vacuous.
    const real = await createApp(appWithDiscovery(inject('databaseUrl')));
    try {
      const routes = registeredRoutes(real);

      expect(routes.length).toBeGreaterThan(0);
      expect(undeclared(routes)).toEqual([]);
      // The health route is public on purpose, and a route without a mark requires a session (AUTH-15).
      expect(routes.find((route) => route.route === 'GET /health')?.declaration).toEqual({ kind: 'public' });
    } finally {
      await real.close();
    }

    // A controller with no declaration is caught, and the failure names the route and the options.
    const fixture = await createApp(moduleWith([UndeclaredProbeController]));
    try {
      const routes = registeredRoutes(fixture);

      // The fixture module imports the real app, so its own routes are the ones without a declaration.
      expect(routes.map((route) => route.route)).toEqual(
        expect.arrayContaining(['GET /undeclared-probe/open', 'GET /health']),
      );
      expect(undeclared(routes)).toEqual([
        'GET /undeclared-probe/open declares no access; accepted: @Public(), @AnySession() or @Roles(...)',
      ]);
    } finally {
      await fixture.close();
    }
  });

  it('no route creates an admin or changes a password', async () => {
    const app = await createApp(appWithDiscovery(inject('databaseUrl')));
    try {
      const routes = registeredRoutes(app);

      // The CLI owns account administration (CLI-07), so the whole writing surface of the API is
      // this list. It is an allowlist, not a pattern: a route that writes has to be added here on
      // purpose, and anything else fails below, named.
      const writingRoutes = [
        // A member deletes an application with its posting, skills and events; a product route, not account administration (APP-36).
        'DELETE /applications/:id',
        'DELETE /invitations/:id',
        // The admin removes an alias of a global skill; the skill itself is never deleted (SKL-69, SKL-25).
        'DELETE /skills/:id/aliases/:aliasId',
        // A member edits the posting of an application; a product route, not account administration (APP-28).
        'PATCH /applications/:id/job-posting',
        // A member edits an item of a section of the master resume; a product route, not account administration (RES-08).
        'PATCH /resume/:section/:id',
        // The admin edits the name and category of a global skill, and the text of its aliases (SKL-62, SKL-67).
        'PATCH /skills/:id',
        'PATCH /skills/:id/aliases/:aliasId',
        // A member registers a job posting and its application; a product route, not account administration (APP-01).
        'POST /applications',
        // A member changes the status of an application, adds stages and notes and snoozes the ghost suggestion; product routes, not account administration (APP-20, APP-23, APP-35).
        'POST /applications/:id/events',
        'POST /applications/:id/ghost-snooze',
        'POST /applications/:id/status',
        'POST /auth/admin/login',
        'POST /auth/login',
        'POST /auth/logout',
        'POST /invitations',
        'POST /invitations/:token/accept',
        // A member creates an item of a section of the master resume; a product route, not account administration (RES-07).
        'POST /resume/:section',
        // A member creates a private skill; it is a product route, not account administration (SKL-11).
        'POST /skills',
        // The admin gives a global skill an alias and makes a private skill global; catalog routes, not account administration (SKL-17, SKL-26).
        'POST /skills/:id/aliases',
        'POST /skills/:id/promote',
        // A member replaces the skills of a posting; a product route, not account administration (APP-30).
        'PUT /applications/:id/skills',
        // A member saves the profile of the master resume; a product route, not account administration (RES-03).
        'PUT /resume/profile',
      ];
      const registeredWriting = routes
        .map((route) => route.route)
        .filter((route) => !route.startsWith('GET '))
        .sort();

      // Named one by one first, so a new route reads as itself in the failure instead of as a list diff.
      const outsideAllowlist = registeredWriting.filter((registered) => !writingRoutes.includes(registered));
      if (outsideAllowlist.length > 0) {
        throw new Error(
          `${outsideAllowlist.join(', ')} write to the API outside the allowlist; account administration belongs to the CLI (CLI-07)`,
        );
      }
      expect(registeredWriting).toEqual(writingRoutes);

      // Control: the read surface exists, so the assertion above is not passing over an empty list.
      expect(routes.map((route) => route.route)).toEqual(expect.arrayContaining(['GET /health', 'GET /auth/me']));
    } finally {
      await app.close();
    }
  });
});

describe('access declarations', () => {
  it('records public, any session and roles as the three accepted forms', () => {
    expect(Reflect.getMetadata(ACCESS_KEY, Public()(class {}) as object)).toEqual({ kind: 'public' });
    const anySession = AnySession();
    expect(Reflect.getMetadata(ACCESS_KEY, anySession(class {}) as object)).toEqual({ kind: 'any-session' });
    const roles = Roles('admin');
    expect(Reflect.getMetadata(ACCESS_KEY, roles(class {}) as object)).toEqual({ kind: 'roles', roles: ['admin'] });
  });
});
