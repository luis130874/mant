import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_SUPER_ADMIN_EMAIL,
  buildPermisos,
  canValidateDigitalOrder,
  FULL_PERMISOS,
  hasActionAccess,
  hasModuleAccess,
  makeInviteIdForEmail,
  makeSafeDocId,
} from '../rbac';
import type { UserProfile } from '../../types';

const makeUser = (overrides: Partial<UserProfile>): UserProfile => ({
  uid: 'uid-123',
  email: 'user@prodexus.uy',
  nombre: 'Usuario Prueba',
  role: 'company_user',
  empresaCodigo: 'EMP-01',
  empresaNombre: 'Planta Uno',
  permisos: buildPermisos(['dashboard', 'preventivos'], ['cerrar_ordenes']),
  activo: true,
  ...overrides,
});

describe('rbac utilities', () => {
  it('enforces active status and role-based module/action permissions', () => {
    const inactive = makeUser({ activo: false, role: 'super_admin' });
    expect(hasModuleAccess(inactive, 'dashboard')).toBe(false);
    expect(hasActionAccess(inactive, 'eliminar')).toBe(false);

    const superAdmin = makeUser({ role: 'super_admin', permisos: buildPermisos([], []) });
    expect(hasModuleAccess(superAdmin, 'usuarios')).toBe(true);
    expect(hasActionAccess(superAdmin, 'eliminar')).toBe(true);

    const companyAdmin = makeUser({ role: 'company_admin', permisos: FULL_PERMISOS });
    expect(hasModuleAccess(companyAdmin, 'usuarios')).toBe(true);
    expect(hasActionAccess(companyAdmin, 'crear_editar')).toBe(true);

    const technician = makeUser({});
    expect(hasModuleAccess(technician, 'preventivos')).toBe(true);
    expect(hasModuleAccess(technician, 'usuarios')).toBe(false);
    expect(hasModuleAccess(technician, 'manual')).toBe(true);
    expect(hasActionAccess(technician, 'cerrar_ordenes')).toBe(true);
    expect(hasActionAccess(technician, 'eliminar')).toBe(false);
  });

  it('determines digital supervisor validation privileges properly', () => {
    const basicTech = makeUser({
      cargo: 'Técnico Mecánico',
      permisos: buildPermisos(['preventivos'], ['cerrar_ordenes']),
    });
    expect(canValidateDigitalOrder(basicTech)).toBe(false);

    const supervisorByPerm = makeUser({
      cargo: 'Operador',
      permisos: buildPermisos(['preventivos'], ['cerrar_ordenes', 'emitir_ordenes']),
    });
    expect(canValidateDigitalOrder(supervisorByPerm)).toBe(true);

    const supervisorByRole = makeUser({ role: 'company_admin' });
    expect(canValidateDigitalOrder(supervisorByRole)).toBe(true);

    const supervisorByTitle = makeUser({ cargo: 'Jefe de Mantenimiento' });
    expect(canValidateDigitalOrder(supervisorByTitle)).toBe(true);
  });

  it('creates deterministic safe Firestore doc IDs and email invite IDs <= 120 chars', () => {
    const idA = makeInviteIdForEmail('Alice.Smith+test@Empresa.UY');
    const idB = makeInviteIdForEmail('alice.smith+test@empresa.uy');
    const idDot = makeInviteIdForEmail('alice_smith+test@empresa.uy');

    expect(idA).toBe(idB);
    expect(idA).not.toBe(idDot);
    expect(idA.length).toBeLessThanOrEqual(120);
    expect(idA).toMatch(/^inv_[a-z0-9_]+$/);

    const safe = makeSafeDocId('EMP / Planta #01 (Sur)');
    expect(safe).toBe('EMP-Planta-01-Sur');
    expect(safe.length).toBeLessThanOrEqual(120);
  });

  it('does not hardcode any personal super admin email', () => {
    expect(BOOTSTRAP_SUPER_ADMIN_EMAIL).not.toBe('luismarcelosanchez1974@gmail.com');
  });
});
