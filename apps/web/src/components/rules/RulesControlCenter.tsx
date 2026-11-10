import React from 'react';
import type { SanitaryRule, Telemetry } from '../../lib/types';
import { Sliders, Zap, RotateCcw, Volume2, ShieldAlert } from 'lucide-react';

interface RulesControlCenterProps {
  rules: SanitaryRule[];
  onUpdateRule: (updatedRule: SanitaryRule) => void;
  onResetRules: () => void;
  onTestRelayPulse: () => void;
  telemetry: Telemetry;
}

export const RulesControlCenter: React.FC<RulesControlCenterProps> = ({
  rules,
  onUpdateRule,
  onResetRules,
  onTestRelayPulse,
  telemetry,
}) => {
  const handleDurationChange = (rule: SanitaryRule, val: number) => {
    onUpdateRule({
      ...rule,
      min_duration_sec: Math.max(0.5, val)
    });
  };

  const handleToggleRelay = (rule: SanitaryRule) => {
    onUpdateRule({
      ...rule,
      relay_active: !rule.relay_active
    });
  };

  const handleToggleSiren = (rule: SanitaryRule) => {
    onUpdateRule({
      ...rule,
      sound_siren: !rule.sound_siren
    });
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#0b121e] border border-slate-800 rounded-xl">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100 font-mono tracking-wide">
              M05 & M08. CENTRO DE CONTROL DE REGLAS & ACTUADORES DE 24V
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configuración de umbrales antirrebote (2 a 4s), deduplicación SHA-256 y banco de relés industriales optoaislados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onTestRelayPulse}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-red-600/80 hover:bg-red-500 text-white shadow-lg transition"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Test Pulso Relé 24V (Sirena 105 dB)</span>
          </button>

          <button
            onClick={onResetRules}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>
        </div>
      </div>

      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            BANCO INDUSTRIAL DE RELÉS OPTOAISLADOS (24V DC / AISLAMIENTO GALVÁNICO)
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Hardware: Modbus RTU / Optocoupler 24V
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className={`p-3 rounded-lg border transition ${
            telemetry.relay_24v_active 
              ? 'bg-red-950/80 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
              : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-bold">RELÉ #1</span>
              <span className={`w-2.5 h-2.5 rounded-full ${telemetry.relay_24v_active ? 'bg-red-500 animate-ping' : 'bg-slate-700'}`} />
            </div>
            <div className="text-slate-200 font-semibold">Sirena 105 dB</div>
            <div className={`text-[10px] mt-1 ${telemetry.relay_24v_active ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
              {telemetry.relay_24v_active ? 'CIRCUITO CERRADO (ENERGIZADO)' : 'CIRCUITO ABIERTO'}
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-slate-950 border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-bold">RELÉ #2</span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </div>
            <div className="text-slate-200 font-semibold">Luz Estroboscópica</div>
            <div className="text-[10px] mt-1 text-slate-500">CIRCUITO ABIERTO</div>
          </div>

          <div className="p-3 rounded-lg border bg-slate-950 border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-bold">RELÉ #3</span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </div>
            <div className="text-slate-200 font-semibold">Aviso Supervisor PLC</div>
            <div className="text-[10px] mt-1 text-slate-500">CIRCUITO ABIERTO</div>
          </div>

          <div className="p-3 rounded-lg border bg-slate-950 border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-bold">RELÉ #4</span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </div>
            <div className="text-slate-200 font-semibold">Solenoide Desinfección</div>
            <div className="text-[10px] mt-1 text-slate-500">CIRCUITO ABIERTO</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-lg">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">CÓDIGO REGLA</th>
              <th className="py-2.5 px-3">CONDICIÓN ESPACIOTEMPORAL</th>
              <th className="py-2.5 px-3">SEVERIDAD</th>
              <th className="py-2.5 px-3">TIEMPO MÍN. ANTIRREBOTE</th>
              <th className="py-2.5 px-3">RELÉ 24V</th>
              <th className="py-2.5 px-3">SIRENA AUDIO</th>
              <th className="py-2.5 px-3">ACCIÓN OPERATIVA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {rules.map(rule => (
              <tr key={rule.id} className="hover:bg-slate-900/60 transition">
                <td className="py-3 px-3 font-bold text-cyan-400">{rule.code}</td>
                <td className="py-3 px-3 text-slate-200">
                  <div className="font-semibold">{rule.description}</div>
                  <div className="text-[10px] text-slate-500">{rule.condition}</div>
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                    rule.severity === 'CRÍTICA' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  }`}>
                    {rule.severity}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="600"
                      value={rule.min_duration_sec}
                      onChange={e => handleDurationChange(rule, parseFloat(e.target.value) || 1.0)}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-cyan-300 font-bold text-center focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-slate-400 text-[11px]">seg</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <button
                    onClick={() => handleToggleRelay(rule)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                      rule.relay_active ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>PIN #{rule.relay_pin} {rule.relay_active ? 'ON' : 'OFF'}</span>
                  </button>
                </td>
                <td className="py-3 px-3">
                  <button
                    onClick={() => handleToggleSiren(rule)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                      rule.sound_siren ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>{rule.sound_siren ? 'SONIDO ACTIVO' : 'MUDO'}</span>
                  </button>
                </td>
                <td className="py-3 px-3 text-slate-400 text-[11px]">{rule.action_target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span>Fórmula de Deduplicación en RAM:</span>
          <code className="text-cyan-300 bg-slate-900 px-2 py-0.5 rounded">
            DedupKey = SHA256(ruleId + cameraId + trackId + roiId)
          </code>
        </div>
        <div className="text-[11px] text-slate-500">
          Garantiza cero saturación de base de datos ni oscilaciones repetitivas de sirena.
        </div>
      </div>
    </div>
  );
};
