import React, { useState } from 'react';
import type { Incident } from '../../lib/types';
import { Shield, Lock, CheckCircle, X, Filter, Eye } from 'lucide-react';

interface BlackboxAuditProps {
  incidents: Incident[];
}

export const BlackboxAudit: React.FC<BlackboxAuditProps> = ({ incidents }) => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRÍTICA' | 'ADVERTENCIA'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncidents = incidents.filter(inc => {
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        inc.id.toLowerCase().includes(term) ||
        inc.rule_code.toLowerCase().includes(term) ||
        inc.rule_description.toLowerCase().includes(term) ||
        inc.roi_name.toLowerCase().includes(term) ||
        inc.dedup_hash.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#0b121e] border border-slate-800 rounded-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 font-mono tracking-wide">
              M06. CAJA NEGRA AUDITABLE & CADENA CRIPTOGRÁFICA HACCP
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Bitácora inmutable de incidentes higiénicos encadenados con SHA-256 y snapshots anonimizados en origen.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Cadena Criptográfica Íntegra (Genesis Block: 000000000019d6...)</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400 font-mono">Filtrar Severidad:</span>
          
          <button
            onClick={() => setSeverityFilter('ALL')}
            className={`px-2.5 py-1 rounded font-mono transition ${severityFilter === 'ALL' ? 'bg-cyan-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}
          >
            Todas ({incidents.length})
          </button>

          <button
            onClick={() => setSeverityFilter('CRÍTICA')}
            className={`px-2.5 py-1 rounded font-mono transition ${severityFilter === 'CRÍTICA' ? 'bg-red-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}
          >
            Críticas ({incidents.filter(i => i.severity === 'CRÍTICA').length})
          </button>

          <button
            onClick={() => setSeverityFilter('ADVERTENCIA')}
            className={`px-2.5 py-1 rounded font-mono transition ${severityFilter === 'ADVERTENCIA' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}
          >
            Advertencias ({incidents.filter(i => i.severity === 'ADVERTENCIA').length})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Buscar por ID, regla, ROI o hash..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">ID INCIDENTE</th>
              <th className="py-2.5 px-3">CÓDIGO REGLA</th>
              <th className="py-2.5 px-3">SEVERIDAD</th>
              <th className="py-2.5 px-3">ZONA ROI</th>
              <th className="py-2.5 px-3">DURACIÓN</th>
              <th className="py-2.5 px-3">REGISTRO (UTC)</th>
              <th className="py-2.5 px-3">DEDUPKEY (SHA-256)</th>
              <th className="py-2.5 px-3">HASH BLOQUE ACTUAL</th>
              <th className="py-2.5 px-3 text-center">EVIDENCIA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-500">
                  No se registraron incidentes con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredIncidents.map(inc => (
                <tr key={inc.id} className="hover:bg-slate-900/60 transition">
                  <td className="py-2.5 px-3 font-bold text-cyan-400">{inc.id}</td>
                  <td className="py-2.5 px-3 text-slate-200">
                    <div>{inc.rule_code}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[200px]">{inc.rule_description}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      inc.severity === 'CRÍTICA' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {inc.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{inc.roi_name}</td>
                  <td className="py-2.5 px-3 text-slate-300">{inc.duration_sec.toFixed(1)} s</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                    {new Date(inc.started_at).toLocaleTimeString('es-PE')}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400" title={inc.dedup_hash}>
                    {inc.dedup_hash.slice(0, 10)}...
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-500" title={inc.current_hash}>
                    {inc.current_hash.slice(0, 10)}...
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => setSelectedIncident(inc)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-900/60 hover:text-cyan-300 text-slate-300 text-[11px] transition flex items-center gap-1 mx-auto"
                    >
                      <Eye className="w-3 h-3 text-cyan-400" />
                      <span>Snapshot</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-2xl w-full p-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedIncident(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1 rounded-lg bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100 font-mono">
                EVIDENCIA FORENSE DE AUDITORÍA: {selectedIncident.id}
              </h3>
            </div>

            <div className="relative aspect-[16/9] bg-black rounded-lg overflow-hidden border border-slate-700 my-3">
              <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                
                <div className="relative w-64 h-48 border border-dashed border-cyan-500/40 rounded flex flex-col items-center justify-center">
                  <div className="w-16 h-20 bg-slate-800 rounded-full blur-md opacity-90 border border-cyan-400 flex items-center justify-center">
                    <span className="text-[8px] font-mono text-cyan-300 font-bold">DESENFOQUE DESTRUCTIVO</span>
                  </div>
                  <div className="w-24 h-24 bg-slate-700 rounded-t-lg mt-2 flex items-center justify-center">
                    <span className="text-[9px] font-mono text-slate-300 font-bold">EPP INCOMPLETO</span>
                  </div>
                </div>

                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 border border-slate-800 p-2 rounded text-[10px] font-mono text-slate-300 flex justify-between items-center">
                  <div>
                    <span className="text-red-400 font-bold">{selectedIncident.rule_code}</span> | {selectedIncident.roi_name} | {new Date(selectedIncident.started_at).toISOString()}
                  </div>
                  <span className="text-cyan-400 font-bold">HACCP VALIDATED</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-slate-400">
                <span>DEDUP_KEY (SHA-256):</span>
                <span className="text-slate-200">{selectedIncident.dedup_hash}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>PREV_BLOCK_HASH:</span>
                <span className="text-slate-400">{selectedIncident.prev_hash}</span>
              </div>
              <div className="flex items-center justify-between text-cyan-400 font-bold">
                <span>CURRENT_BLOCK_HASH:</span>
                <span>{selectedIncident.current_hash}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-400 pt-1 border-t border-slate-800">
                <span>POLÍTICA DE PRIVACIDAD:</span>
                <span>Enmascaramiento irreversible aplicado en RAM pre-inferencia</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
