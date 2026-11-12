import React from 'react';
import type { SanitaryRule, Telemetry } from '../../lib/types';
import { Sliders, Zap, RotateCcw, Volume2, ShieldAlert } from 'lucide-react';

interface RulesControlCenterProps {
  rules: SanitaryRule[];
  onUpdateRule: (updatedRule: SanitaryRule) => void;
  onResetRules: () => void;
  onTestRelayPulse: () => void;
  telemetry: Telemetry;
  canEditRules?: boolean;
  canTestRelay?: boolean;
}

export const RulesControlCenter: React.FC<RulesControlCenterProps> = ({
  rules,
  onUpdateRule,
  onResetRules,
  onTestRelayPulse,
  telemetry,
  canEditRules = true,
  canTestRelay = true,
}) => {
  const handleDurationChange = (rule: SanitaryRule, val: number) => {
    onUpdateRule({
      ...rule,
      min_duration_sec: Math.max(0.5, val),
    });
  };

  const handleToggleRelay = (rule: SanitaryRule) => {
    onUpdateRule({
      ...rule,
      relay_active: !rule.relay_active,
    });
  };

  const handleToggleSiren = (rule: SanitaryRule) => {
    onUpdateRule({
      ...rule,
      sound_siren: !rule.sound_siren,
    });
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#171c26] border border-[#262d3b] rounded-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#262d3b] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Reglas Sanitarias y Banco de Relés (24V)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configuración de umbrales de tolerancia temporal y salidas físicas optoaisladas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTestRelayPulse}
            disabled={!canTestRelay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-red-700 hover:bg-red-600 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Probar pulso de relé 24V</span>
          </button>

          <button
            onClick={onResetRules}
            disabled={!canEditRules}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#1e2430] text-slate-300 border border-[#2d3646] hover:bg-[#252c3b] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>
        </div>
      </div>

      {!canEditRules && (
        <div className="px-3.5 py-2.5 rounded-md bg-[#131720] border border-[#262d3b] text-xs text-slate-400">
          Modo solo lectura para el rol actual. Solo el Administrador puede modificar umbrales y salidas de relé.
        </div>
      )}

      <div className="p-4 bg-[#131720] border border-[#232936] rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Estado del Banco de Relés (24V DC)
          </span>
          <span className="text-[11px] font-mono text-slate-500">Modbus RTU / Optoaislado</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div
            className={`p-3 rounded-md border transition ${
              telemetry.relay_24v_active
                ? 'bg-red-950/60 border-red-700'
                : 'bg-[#0f131b] border-[#232936]'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-mono font-semibold">RELÉ #1</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  telemetry.relay_24v_active ? 'bg-red-500' : 'bg-slate-600'
                }`}
              />
            </div>
            <div className="text-slate-200 font-medium">Sirena 105 dB</div>
            <div
              className={`text-[11px] mt-1 ${
                telemetry.relay_24v_active ? 'text-red-300 font-semibold' : 'text-slate-500'
              }`}
            >
              {telemetry.relay_24v_active ? 'Cerrado (Energizado)' : 'Abierto'}
            </div>
          </div>

          {[
            { id: 'RELÉ #2', label: 'Luz Estroboscópica' },
            { id: 'RELÉ #3', label: 'Aviso Supervisor PLC' },
            { id: 'RELÉ #4', label: 'Solenoide Desinfección' },
          ].map(relay => (
            <div key={relay.id} className="p-3 rounded-md border bg-[#0f131b] border-[#232936]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-400 font-mono font-semibold">{relay.id}</span>
                <span className="w-2 h-2 rounded-full bg-slate-600" />
              </div>
              <div className="text-slate-200 font-medium">{relay.label}</div>
              <div className="text-[11px] mt-1 text-slate-500">Abierto</div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-[#232936] rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#11151d] text-slate-400 border-b border-[#232936] uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-2.5 px-3 font-medium">Código</th>
              <th className="py-2.5 px-3 font-medium">Condición</th>
              <th className="py-2.5 px-3 font-medium">Severidad</th>
              <th className="py-2.5 px-3 font-medium">Tolerancia</th>
              <th className="py-2.5 px-3 font-medium">Relé 24V</th>
              <th className="py-2.5 px-3 font-medium">Alarma sonora</th>
              <th className="py-2.5 px-3 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232936] bg-[#131720]">
            {rules.map(rule => (
              <tr key={rule.id} className="hover:bg-[#1a202c] transition">
                <td className="py-3 px-3 font-mono font-semibold text-blue-400">{rule.code}</td>
                <td className="py-3 px-3 text-slate-200">
                  <div className="font-medium">{rule.description}</div>
                  <div className="text-[11px] text-slate-400">{rule.condition}</div>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      rule.severity === 'CRÍTICA'
                        ? 'bg-red-950/60 text-red-300 border-red-800/60'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                    }`}
                  >
                    {rule.severity}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="600"
                      disabled={!canEditRules}
                      value={rule.min_duration_sec}
                      onChange={e => handleDurationChange(rule, parseFloat(e.target.value) || 1.0)}
                      className="w-16 px-2 py-1 bg-[#0f131b] border border-[#2d3646] rounded text-slate-100 font-mono tabular-nums text-center focus:border-blue-500 focus:outline-none disabled:opacity-60"
                    />
                    <span className="text-slate-400 text-[11px]">s</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <button
                    onClick={() => handleToggleRelay(rule)}
                    disabled={!canEditRules}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed ${
                      rule.relay_active
                        ? 'bg-red-950/60 text-red-300 border-red-800/60'
                        : 'bg-[#1a202c] text-slate-500 border-[#283040]'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>Pin {rule.relay_pin}: {rule.relay_active ? 'Sí' : 'No'}</span>
                  </button>
                </td>
                <td className="py-3 px-3">
                  <button
                    onClick={() => handleToggleSiren(rule)}
                    disabled={!canEditRules}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition inline-flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed ${
                      rule.sound_siren
                        ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                        : 'bg-[#1a202c] text-slate-500 border-[#283040]'
                    }`}
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{rule.sound_siren ? 'Habilitada' : 'Silenciada'}</span>
                  </button>
                </td>
                <td className="py-3 px-3 text-slate-400 text-[11px]">{rule.action_target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-[#11151d] rounded-md border border-[#232936] text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-blue-400" />
          <span>Deduplicación en memoria:</span>
          <code className="text-slate-300 bg-[#171c26] px-2 py-0.5 rounded font-mono text-[11px] border border-[#262d3b]">
            SHA256(ruleId + cameraId + trackId + roiId)
          </code>
        </div>
        <span className="text-[11px] text-slate-500">
          Evita registros duplicados ante incidencias continuas.
        </span>
      </div>
    </div>
  );
};
