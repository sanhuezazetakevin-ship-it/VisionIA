import type { Role } from './types';

export interface RolePermissions {
  label: string;
  allowedTabs: ('hud' | 'bev' | 'blackbox' | 'rules' | 'reports' | 'cameras')[];
  canResolveIncidents: boolean;
  canPauseAlerts: boolean;
  canLogSanitization: boolean;
  canSwitchCamera: boolean;
  canEditRules: boolean;
  canTestRelay: boolean;
  canEditCalibration: boolean;
  canEditReportConfig: boolean;
  canExportReports: boolean;
}

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  ADMIN: {
    label: 'Administrador',
    allowedTabs: ['hud', 'bev', 'blackbox', 'rules', 'reports', 'cameras'],
    canResolveIncidents: true,
    canPauseAlerts: true,
    canLogSanitization: true,
    canSwitchCamera: true,
    canEditRules: true,
    canTestRelay: true,
    canEditCalibration: true,
    canEditReportConfig: true,
    canExportReports: true,
  },
  SUPERVISOR: {
    label: 'Supervisor de Turno',
    allowedTabs: ['hud', 'bev', 'blackbox', 'rules', 'reports', 'cameras'],
    canResolveIncidents: true,
    canPauseAlerts: true,
    canLogSanitization: true,
    canSwitchCamera: true,
    canEditRules: false,
    canTestRelay: false,
    canEditCalibration: false,
    canEditReportConfig: false,
    canExportReports: true,
  },
  AUDITOR: {
    label: 'Auditor HACCP',
    allowedTabs: ['hud', 'blackbox', 'reports', 'cameras'],
    canResolveIncidents: false,
    canPauseAlerts: false,
    canLogSanitization: false,
    canSwitchCamera: true,
    canEditRules: false,
    canTestRelay: false,
    canEditCalibration: false,
    canEditReportConfig: false,
    canExportReports: true,
  },
  OPERADOR: {
    label: 'Operador',
    allowedTabs: ['hud', 'cameras'],
    canResolveIncidents: false,
    canPauseAlerts: false,
    canLogSanitization: false,
    canSwitchCamera: false,
    canEditRules: false,
    canTestRelay: false,
    canEditCalibration: false,
    canEditReportConfig: false,
    canExportReports: false,
  },
};
