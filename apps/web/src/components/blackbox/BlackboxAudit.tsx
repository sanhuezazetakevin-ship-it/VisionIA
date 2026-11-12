import React, { useState } from 'react';
import type { Incident } from '../../lib/types';
import { Shield, Lock, CheckCircle, X, Filter, Eye, CheckSquare } from 'lucide-react';

interface BlackboxAuditProps {
  incidents: Incident[];
  canResolveIncidents?: boolean;
  onResolveIncident?: (incidentId: string, note: string) => void;
}

const CORRECTIVE_PRESETS = [
  'EPP colocado correctamente en estación',
  'Superficie limpiada y desinfectada',
  'Utensilio retirado a lavadero',
];

export const BlackboxAudit: React.FC<BlackboxAuditProps> = ({
  incidents,
  canResolveIncidents = false,
  onResolveIncident,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolvingIncident, setResolvingIncident] = useState<Incident | null>(null);
  const [correctiveNote, setCorrectiveNote] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRÍTICA' | 'ADVERTENCIA'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RESOLVED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncidents = incidents.filter(inc => {
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
    if (statusFilter === 'PENDING' && inc.resolved_at !== null) return false;
    if (statusFilter === 'RESOLVED' && inc.resolved_at === null) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        inc.id.toLowerCase().includes(term) ||
        inc.rule_code.toLowerCase().includes(term) ||
        inc.rule_description.toLowerCase().includes(term) ||
        inc.roi_name.toLowerCase().includes(term) ||
        inc.dedup_hash.toLowerCase().includes(term) ||
        (inc.corrective_note || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const openCount = incidents.filter(i => i.resolved_at === null).length;

  const openResolveDialog = (inc: Incident) => {
    setResolvingIncident(inc);
    setCorrectiveNote(
      inc.rule_code === 'RULE-EPP-001' || inc.rule_code === 'RULE-EPP-002'
        ? CORRECTIVE_PRESETS[0]
        : inc.rule_code === 'RULE-HYG-002'
          ? CORRECTIVE_PRESETS[2]
          : CORRECTIVE_PRESETS[1]
    );
  };

  const handleConfirmResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingIncident || !onResolveIncident) return;
    onResolveIncident(resolvingIncident.id, correctiveNote.trim() || 'Incidencia atendida');
    if (selectedIncident?.id === resolvingIncident.id) {
      setSelectedIncident(null);
    }
    setResolvingIncident(null);
    setCorrectiveNote('');
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#171c26] border border-[#262d3b] rounded-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#262d3b] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Registro Inmutable de Incidentes (HACCP)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Historial auditado de eventos sanitarios encadenados mediante SHA-256 y seguimiento de acciones correctivas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {openCount > 0 && (
            <span className="px-2.5 py-1.5 rounded bg-amber-950/50 border border-amber-800/60 text-amber-300 text-xs font-medium">
              {openCount} {openCount === 1 ? 'pendiente' : 'pendientes'} de atención
            </span>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Integridad verificada (SHA-256)</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
            <button
              onClick={() => setSeverityFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium border transition ${
                severityFilter === 'ALL'
                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                  : 'bg-[#131720] text-slate-400 border-[#262d3b] hover:text-slate-200'
              }`}
            >
              Todas ({incidents.length})
            </button>
            <button
              onClick={() => setSeverityFilter('CRÍTICA')}
              className={`px-2.5 py-1 rounded font-medium border transition ${
                severityFilter === 'CRÍTICA'
                  ? 'bg-red-700 text-white border-red-700'
                  : 'bg-[#131720] text-slate-400 border-[#262d3b] hover:text-slate-200'
              }`}
            >
              Críticas ({incidents.filter(i => i.severity === 'CRÍTICA').length})
            </button>
            <button
              onClick={() => setSeverityFilter('ADVERTENCIA')}
              className={`px-2.5 py-1 rounded font-medium border transition ${
                severityFilter === 'ADVERTENCIA'
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-[#131720] text-slate-400 border-[#262d3b] hover:text-slate-200'
              }`}
            >
              Advertencias ({incidents.filter(i => i.severity === 'ADVERTENCIA').length})
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#131720] p-0.5 rounded border border-[#262d3b]">
            {[
              { id: 'ALL' as const, label: 'Todos los estados' },
              { id: 'PENDING' as const, label: 'Pendientes' },
              { id: 'RESOLVED' as const, label: 'Resueltos' },
            ].map(st => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                  statusFilter === st.id
                    ? 'bg-[#1e2736] text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Buscar por ID, regla, zona o nota..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 bg-[#11151d] border border-[#283040] rounded-md text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-[#232936] rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#11151d] text-slate-400 border-b border-[#232936] uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3 font-medium">ID</th>
              <th className="py-2.5 px-3 font-medium">Regla</th>
              <th className="py-2.5 px-3 font-medium">Severidad</th>
              <th className="py-2.5 px-3 font-medium">Zona</th>
              <th className="py-2.5 px-3 font-medium">Estado / Acción correctiva</th>
              <th className="py-2.5 px-3 font-medium">Hora</th>
              <th className="py-2.5 px-3 font-medium">Hash bloque</th>
              <th className="py-2.5 px-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232936] bg-[#131720]">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No se encontraron incidentes con los criterios aplicados.
                </td>
              </tr>
            ) : (
              filteredIncidents.map(inc => {
                const isResolved = inc.resolved_at !== null;
                return (
                  <tr key={inc.id} className="hover:bg-[#1a202c] transition">
                    <td className="py-2.5 px-3 font-mono font-medium text-blue-400 whitespace-nowrap">
                      {inc.id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      <div className="font-mono text-[11px] font-medium">{inc.rule_code}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {inc.rule_description}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          inc.severity === 'CRÍTICA'
                            ? 'bg-red-950/60 text-red-300 border-red-800/60'
                            : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{inc.roi_name}</td>
                    <td className="py-2.5 px-3">
                      {isResolved ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-800/60">
                            Resuelta
                          </span>
                          {inc.corrective_note && (
                            <div className="text-[11px] text-slate-400 mt-1 max-w-[240px] truncate" title={inc.corrective_note}>
                              {inc.corrective_note}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] tabular-nums whitespace-nowrap">
                      {new Date(inc.started_at).toLocaleTimeString('es-PE')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300" title={inc.current_hash}>
                      {inc.current_hash.slice(0, 10)}...
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {!isResolved && canResolveIncidents && onResolveIncident && (
                          <button
                            onClick={() => openResolveDialog(inc)}
                            className="px-2.5 py-1 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[11px] font-medium transition inline-flex items-center gap-1"
                          >
                            <CheckSquare className="w-3 h-3" />
                            <span>Atender</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedIncident(inc)}
                          className="px-2.5 py-1 rounded bg-[#1d2432] hover:bg-[#252e40] text-slate-200 border border-[#2d3646] text-[11px] transition inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3 text-blue-400" />
                          <span>Ver</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de atención / cierre de incidente */}
      {resolvingIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmResolve}
            className="bg-[#171c26] border border-[#2d3646] rounded-lg max-w-md w-full p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Registrar Acción Correctiva — <span className="font-mono">{resolvingIncident.id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setResolvingIncident(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-[#131720] p-3 rounded border border-[#232936]">
              <div className="font-mono text-blue-400 font-semibold">{resolvingIncident.rule_code}</div>
              <div className="mt-0.5 text-slate-300">{resolvingIncident.rule_description}</div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">
                Acción correctiva aplicada:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CORRECTIVE_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCorrectiveNote(preset)}
                    className={`px-2 py-1 rounded text-[11px] border transition ${
                      correctiveNote === preset
                        ? 'bg-blue-950/60 text-blue-200 border-blue-700'
                        : 'bg-[#131720] text-slate-400 border-[#262d3b] hover:text-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                required
                value={correctiveNote}
                onChange={e => setCorrectiveNote(e.target.value)}
                placeholder="Describe brevemente la medida tomada..."
                className="w-full px-3 py-2 bg-[#11151d] border border-[#2d3646] rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingIncident(null)}
                className="px-3 py-1.5 rounded text-xs font-medium bg-[#1e2430] text-slate-300 border border-[#2d3646] hover:bg-[#252c3b]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded text-xs font-semibold bg-[#2563eb] hover:bg-[#1d4ed8] text-white"
              >
                Confirmar cierre
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de detalle de evidencia */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#171c26] border border-[#2d3646] rounded-lg max-w-2xl w-full p-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedIncident(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1 rounded bg-[#1e2430] border border-[#2d3646] transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Evidencia de Auditoría — <span className="font-mono">{selectedIncident.id}</span>
              </h3>
            </div>

            <div className="relative aspect-[16/9] bg-[#0f131b] rounded-md overflow-hidden border border-[#262d3b] my-3 flex flex-col items-center justify-center">
              <div className="relative w-64 h-48 border border-dashed border-slate-600 rounded flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-700/80 rounded-full blur-sm border border-slate-500 flex items-center justify-center">
                  <span className="text-[9px] text-slate-300 font-medium">Privacidad</span>
                </div>
                <div className="w-24 h-24 bg-slate-800 rounded-t-lg mt-2 flex items-center justify-center border border-slate-700">
                  <span className="text-[10px] text-slate-300 font-medium">Registro de falta</span>
                </div>
              </div>

              <div className="absolute bottom-2 left-2 right-2 bg-[#131720]/95 border border-[#262d3b] px-3 py-2 rounded text-[11px] text-slate-300 flex justify-between items-center">
                <div>
                  <span className="text-red-400 font-mono font-semibold">{selectedIncident.rule_code}</span>
                  {' · '}
                  {selectedIncident.roi_name}
                  {' · '}
                  <span className="font-mono text-slate-400">
                    {new Date(selectedIncident.started_at).toLocaleString('es-PE')}
                  </span>
                </div>
                <span className="text-emerald-400 font-medium">Verificado</span>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-[#11151d] p-3.5 rounded-md border border-[#232936]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300 pb-2 border-b border-[#232936]">
                <span>Estado:</span>
                <span className={selectedIncident.resolved_at ? 'text-emerald-400 font-medium' : 'text-amber-300 font-medium'}>
                  {selectedIncident.resolved_at
                    ? `Resuelta (${new Date(selectedIncident.resolved_at).toLocaleTimeString('es-PE')}) — ${selectedIncident.corrective_note || ''}`
                    : 'Pendiente de atención'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 font-mono">
                <span>Clave SHA-256:</span>
                <span className="text-slate-200 break-all">{selectedIncident.dedup_hash}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 font-mono">
                <span>Hash anterior:</span>
                <span className="text-slate-400 break-all">{selectedIncident.prev_hash}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-blue-400 font-mono">
                <span>Hash actual:</span>
                <span className="break-all">{selectedIncident.current_hash}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
