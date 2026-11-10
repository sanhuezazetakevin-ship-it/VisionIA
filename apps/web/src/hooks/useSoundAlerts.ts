import { useRef, useCallback, useState } from 'react';

/**
 * Hook para control de alarmas acústicas mediante Web Audio API.
 * Cumple con M08 (Control de Actuadores y Relés - Sirena de 105 dB).
 */
export function useSoundAlerts() {
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenOscillatorRef = useRef<OscillatorNode | null>(null);
  const sirenGainRef = useRef<GainNode | null>(null);
  const isSirenPlayingRef = useRef<boolean>(false);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Tono de advertencia corto (2 beeps ámbar)
   */
  const playWarningBeep = useCallback(() => {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(620, now);
    osc1.frequency.setValueAtTime(740, now + 0.1);

    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.25);
  }, [isMuted, getAudioContext]);

  /**
   * Sirena industrial de 105 dB (pulsos oscilantes agudos)
   */
  const startIndustrialSiren = useCallback(() => {
    if (isMuted || isSirenPlayingRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);

      // LFO para oscilar entre 600 Hz y 1100 Hz simulando sirena industrial
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(3.5, ctx.currentTime); // 3.5 ciclos por segundo

      lfoGain.gain.setValueAtTime(300, ctx.currentTime); // Amplitud de modulación de frecuencia

      lfo.connect(osc.frequency);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start();
      osc.start();

      sirenOscillatorRef.current = osc;
      sirenGainRef.current = gain;
      isSirenPlayingRef.current = true;
    } catch (e) {
      console.warn('AudioContext alert error:', e);
    }
  }, [isMuted, getAudioContext]);

  const stopIndustrialSiren = useCallback(() => {
    if (sirenOscillatorRef.current) {
      try {
        sirenOscillatorRef.current.stop();
        sirenOscillatorRef.current.disconnect();
      } catch (e) {
        // Ignorar si ya estaba detenido
      }
      sirenOscillatorRef.current = null;
    }
    isSirenPlayingRef.current = false;
  }, []);

  const triggerTestSirenPulse = useCallback((durationMs = 800) => {
    startIndustrialSiren();
    setTimeout(() => {
      stopIndustrialSiren();
    }, durationMs);
  }, [startIndustrialSiren, stopIndustrialSiren]);

  return {
    isMuted,
    setIsMuted,
    playWarningBeep,
    startIndustrialSiren,
    stopIndustrialSiren,
    triggerTestSirenPulse,
  };
}
