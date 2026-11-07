import type { MeResponse } from '@am/contracts';
import { describe, expect, it } from 'vitest';
import type { SessionState } from '../api/server-functions';
import { adminAreaAccess, areaOfPath, loginPathOf, memberAreaAccess, signedInHome } from './access';

const member: MeResponse = {
  id: '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60',
  email: 'ana@example.test',
  name: 'Ana',
  role: 'member',
};
const admin: MeResponse = { ...member, email: 'root@example.test', name: 'Root', role: 'admin' };
const as = (user: MeResponse): SessionState => ({ kind: 'authenticated', user });
const anonymous: SessionState = { kind: 'anonymous' };
const unavailable: SessionState = { kind: 'unavailable' };

describe('memberAreaAccess', () => {
  it('lets a member in', () => {
    expect(memberAreaAccess(as(member), '/')).toEqual({ kind: 'allowed', user: member });
  });

  it('sends a visitor to the member login remembering the page asked for', () => {
    expect(memberAreaAccess(anonymous, '/?tab=x')).toEqual({
      kind: 'sign-in',
      area: 'member',
      returnTo: '/?tab=x',
    });
  });

  it('moves an admin to the admin home', () => {
    expect(memberAreaAccess(as(admin), '/')).toEqual({ kind: 'move-to-admin' });
  });

  it('keeps the page and reports unavailable when the api does not answer', () => {
    expect(memberAreaAccess(unavailable, '/')).toEqual({ kind: 'unavailable' });
  });
});

describe('adminAreaAccess', () => {
  it('lets an admin in', () => {
    expect(adminAreaAccess(as(admin), '/admin')).toEqual({ kind: 'allowed', user: admin });
  });

  it('sends a visitor to the admin login remembering the page asked for', () => {
    expect(adminAreaAccess(anonymous, '/admin/invitations')).toEqual({
      kind: 'sign-in',
      area: 'admin',
      returnTo: '/admin/invitations',
    });
  });

  it('shows a member the no-access screen', () => {
    expect(adminAreaAccess(as(member), '/admin')).toEqual({ kind: 'forbidden', user: member });
  });

  it('reports unavailable when the api does not answer', () => {
    expect(adminAreaAccess(unavailable, '/admin')).toEqual({ kind: 'unavailable' });
  });
});

describe('signedInHome', () => {
  it('sends each role away from the login of its own area to that home', () => {
    expect(signedInHome(as(member), 'member')).toBe('/');
    expect(signedInHome(as(admin), 'admin')).toBe('/admin');
  });

  it('keeps the form for a visitor, an unavailable api and the other role', () => {
    expect(signedInHome(anonymous, 'member')).toBeUndefined();
    expect(signedInHome(unavailable, 'admin')).toBeUndefined();
    expect(signedInHome(as(admin), 'member')).toBeUndefined();
    expect(signedInHome(as(member), 'admin')).toBeUndefined();
  });
});

describe('area paths', () => {
  it('names the login of each area', () => {
    expect(loginPathOf('member')).toBe('/login');
    expect(loginPathOf('admin')).toBe('/admin/login');
  });

  it('tells the admin area from the member area by path', () => {
    expect(areaOfPath('/admin')).toBe('admin');
    expect(areaOfPath('/admin/invitations')).toBe('admin');
    expect(areaOfPath('/')).toBe('member');
    expect(areaOfPath('/administrator')).toBe('member');
  });
});
