import { UserRole } from '../types';

export function isBureauRole(role: UserRole): boolean {
  return role !== 'resident';
}

export function canManageFinance(role: UserRole): boolean {
  return role === 'president' || role === 'treasurer';
}

export function canManageMaintenance(role: UserRole): boolean {
  return role === 'president' || role === 'technical';
}

export function canManageGovernance(role: UserRole): boolean {
  return role === 'president' || role === 'treasurer' || role === 'technical';
}

export function canManageSettings(role: UserRole): boolean {
  return role === 'president';
}

export function canManageApartments(role: UserRole): boolean {
  return role === 'president' || role === 'treasurer';
}
