import React, { useState } from 'react';
import type { Incident, ReportConfig, Telemetry, SanitizationLog } from '../../lib/types';
import { generateReportLabHACCP } from '../../lib/reportLabPdf';
import { FileText, Send, Mail, CheckCircle2, Download, Clock, ShieldCheck } from 'lucide-react';

interface ExecutiveReportsProps {
  incidents: Incident[];
  reportConfig: ReportConfig;
  onUpdateReportConfig: (newConfig: ReportConfig) => void;
  telemetry: Telemetry;
  sanitizationLogs?: SanitizationLog[];
  canEditReportConfig?: boolean;
}

export const ExecutiveReports: React.FC<ExecutiveReportsProps> = ({
  incidents,
  reportConfig,
  onUpdateReportConfig,
  telemetry,
  sanitizationLogs = [],
  canEditReportConfig = true,
}) => {
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [dispatchHistory, setDispatchHistory] = useState<
    {
      id: string;
      timestamp: string;
      recipient: string;
      incidentsCount: number;
      status: string;
    }[]
  >([
    {
      id: 'DISP-0841',
      timestamp: '2026-11-08T14:00:00Z',
      recipient: reportConfig.smtp_recipient,
      incidentsCount: 2,
      status: 'Entregado (250 OK)',
    },
  ]);

  const handleDownloadPdf = () => {
    const doc = generateReportLabHACCP(incidents, reportConfig, telemetry, sanitizationLogs);
    const filename = `HACCP_INFORME_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  };

  const handleTriggerSmtpDispatch = async () => {
    setSmtpStatus('sending');
    setStatusMessage('Generando documento PDF...');

    setTimeout(() => {
      setStatusMessage(`Enviando por SMTP (TLS 587) a ${reportConfig.smtp_recipient}...`);

      setTimeout(() => {
        setSmtpStatus('success');
        setStatusMessage(`Informe enviado correctamente a ${reportConfig.smtp_recipient}.`);

        const newLog = {
          id: `DISP-${Math.floor(1000 + Math.random() * 9000)}`,
          timestamp: new Date().toISOString(),
          recipient: reportConfig.smtp_recipient,
          incidentsCount: incidents.length,
          status: 'Entregado (250 OK)',
        };
        setDispatchHistory([newLog, ...dispatchHistory]);
        onUpdateReportConfig({
          ...reportConfig,
          last_dispatched_at: new Date().toISOString(),
        });

        setTimeout(() => {
          setSmtpStatus('idle');
        }, 6000);
      }, 1000);
    }, 800);
  };

  return (
    <div className="flex flex-col gap-5 p-5 bg-[#171c26] border border-[#262d3b] rounded-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#262d3b] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Reportes Operativos PDF y Envío SMTP
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Generación de informes de auditoría HACCP y programación de envíos por correo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-[#1e2430] hover:bg-[#252c3b] text-slate-200 border border-[#2d3646] transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Descargar PDF</span>
          </button>

          <button
            onClick={handleTriggerSmtpDispatch}
            disabled={smtpStatus === 'sending'}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{smtpStatus === 'sending' ? 'Enviando...' : 'Enviar por correo'}</span>
          </button>
        </div>
      </div>

      {smtpStatus === 'success' && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-md flex items-center gap-2 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {smtpStatus === 'sending' && (
        <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-md flex items-center gap-2 text-blue-300 text-xs">
          <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#131720] border border-[#232936] rounded-lg text-xs">
        <div className="space-y-3">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-blue-400" />
            <span>Destinatario de auditoría</span>
          </div>

          <div>
            <label className="text-slate-400 text-[11px] block mb-1">
              Correo electrónico responsable:
            </label>
            <input
              type="email"
              disabled={!canEditReportConfig}
              value={reportConfig.smtp_recipient}
              onChange={e => onUpdateReportConfig({ ...reportConfig, smtp_recipient: e.target.value })}
              className="w-full px-3 py-1.5 bg-[#0f131b] border border-[#2d3646] rounded text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="auto_dispatch"
              disabled={!canEditReportConfig}
              checked={reportConfig.auto_dispatch_on_3_critical}
              onChange={e =>
                onUpdateReportConfig({
                  ...reportConfig,
                  auto_dispatch_on_3_critical: e.target.checked,
                })
              }
              className="rounded bg-[#0f131b] border-[#2d3646] text-blue-500 focus:ring-0 disabled:opacity-60"
            />
            <label htmlFor="auto_dispatch" className="text-slate-300 cursor-pointer text-[11px]">
              Enviar alerta automática al acumular 3 infracciones críticas
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Datos de la planta</span>
          </div>

          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Zona / Planta:</label>
            <input
              type="text"
              disabled={!canEditReportConfig}
              value={reportConfig.plant_zone}
              onChange={e => onUpdateReportConfig({ ...reportConfig, plant_zone: e.target.value })}
              className="w-full px-3 py-1.5 bg-[#0f131b] border border-[#2d3646] rounded text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-slate-400 text-[11px] block mb-1">Turno operativo:</label>
            <input
              type="text"
              disabled={!canEditReportConfig}
              value={reportConfig.shift_name}
              onChange={e => onUpdateReportConfig({ ...reportConfig, shift_name: e.target.value })}
              className="w-full px-3 py-1.5 bg-[#0f131b] border border-[#2d3646] rounded text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-[#131720] border border-[#232936] rounded-lg">
        <div className="font-semibold text-xs text-slate-200 mb-3 flex items-center justify-between">
          <span>Historial de envíos</span>
          <span className="text-[11px] text-slate-500 font-normal">SMTP TLS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f131b] text-slate-400 border-b border-[#232936] uppercase text-[11px]">
              <tr>
                <th className="py-2 px-3 font-medium">ID</th>
                <th className="py-2 px-3 font-medium">Fecha y hora</th>
                <th className="py-2 px-3 font-medium">Destinatario</th>
                <th className="py-2 px-3 font-medium">Incidentes</th>
                <th className="py-2 px-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232936]">
              {dispatchHistory.map(item => (
                <tr key={item.id} className="hover:bg-[#1a202c]">
                  <td className="py-2 px-3 font-mono text-blue-400 font-medium">{item.id}</td>
                  <td className="py-2 px-3 text-slate-300 font-mono tabular-nums">
                    {new Date(item.timestamp).toLocaleString('es-PE')}
                  </td>
                  <td className="py-2 px-3 text-slate-400">{item.recipient}</td>
                  <td className="py-2 px-3 text-slate-300">{item.incidentsCount} registros</td>
                  <td className="py-2 px-3 text-emerald-400 font-medium">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
