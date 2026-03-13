import { useState } from 'react'
import { useAudioEngine } from '../hooks/useAudioEngine'
import { VUMeter } from './VUMeter'
import { Pedal } from './Pedal'
import { AmpPedal } from './AmpPedal'
import { MasterVolPedal } from './MasterVolPedal'
import { DistoPedal } from './DistoPedal'
import { ChorusPedal } from './ChorusPedal'
import { ReverbPedal } from './ReverbPedal'

// Which pedals can be bypassed
type BypassableId = 'disto' | 'chorus' | 'reverb'

export function SignalChain() {
  const {
    state,
    start, stop,
    setInputGain, setOutputGain,
    setEqBass, setEqMid, setEqTreble,
    setChorusRate, setChorusDepth, setChorusMix,
    setDistoDrive, setDistoTone, setDistoLevel,
    setReverbLevel, setReverbType,
    setInputDevice, setOutputDevice,
  } = useAudioEngine()

  const [bypassed, setBypassed] = useState<Record<BypassableId, boolean>>({
    disto: false,
    chorus: false,
    reverb: false,
  })

  const toggle = (id: BypassableId) => setBypassed(p => ({ ...p, [id]: !p[id] }))

  // When bypassed, zero out the pedal's wet/level so audio passes through unchanged
  const distoLevel = bypassed.disto ? 0 : state.distoLevel
  const chorusMix = bypassed.chorus ? 0 : state.chorusMix
  const reverbLevel = bypassed.reverb ? 0 : state.reverbLevel

  return (
    <div className="app">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="header">
        <div className="header-devices">

          {/* Input */}
          <div className="device-group">
            <span className="device-icon">🎙</span>
            {state.inputDevices.length > 0 ? (
              <select
                className="device-select"
                value={state.selectedInputId}
                onChange={e => setInputDevice(e.target.value)}
                disabled={state.isLoading}
              >
                {state.inputDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Microphone'}
                  </option>
                ))}
              </select>
            ) : (
              <span className="device-placeholder">Input</span>
            )}
          </div>

          <div className="device-divider" />

          {/* Output */}
          <div className="device-group">
            <span className="device-icon">🔊</span>
            {state.outputDevices.length > 0 ? (
              <select
                className="device-select"
                value={state.selectedOutputId}
                onChange={e => setOutputDevice(e.target.value)}
                disabled={state.isLoading}
              >
                {state.outputDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Speaker'}
                  </option>
                ))}
              </select>
            ) : (
              <span className="device-placeholder">Output</span>
            )}
          </div>
        </div>

        {/* Power */}
        <button
          className={`power ${state.isActive ? 'on' : ''} ${state.isLoading ? 'loading' : ''}`}
          onClick={() => state.isActive ? stop() : start()}
          disabled={state.isLoading}
        >
          <span className="power-led" />
          {state.isLoading ? 'Starting…' : state.isActive ? 'On' : 'Off'}
        </button>
      </header>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {state.error && (
        <div className="error-banner">⚠ {state.error}</div>
      )}

      {/* ── Pedalboard ──────────────────────────────────────────────── */}
      <main className="pedalboard">

        {/* Guitar Tuner */}
        <Pedal id="tuner" name="Tuner">
          <div className="tuner-display">
            {state.tunerNote ? (
              <>
                <div className="tuner-note">{state.tunerNote}</div>
                <div
                  className="tuner-cents"
                  style={{ color: Math.abs(state.tunerCents || 0) < 8 ? '#4ade80' : '#f97316' }}
                >
                  {(state.tunerCents ?? 0) > 0 ? '+' : ''}{state.tunerCents} ¢
                </div>
                <div className="tuner-bars">
                  {Array.from({ length: 9 }, (_, i) => {
                    const pos = i - 4 // -4 to +4
                    const cents = state.tunerCents ?? 0
                    const active = Math.round(cents / 10) === pos
                    const isCenter = pos === 0
                    return (
                      <div
                        key={i}
                        className={`tuner-bar ${active ? 'tuner-bar--active' : ''} ${isCenter ? 'tuner-bar--center' : ''}`}
                      />
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="tuner-idle">—</div>
            )}
          </div>
        </Pedal>

        {/* Distortion */}
        <DistoPedal
          distoDrive={state.distoDrive}
          distoTone={state.distoTone}
          distoLevel={distoLevel}
          onChangeDrive={setDistoDrive}
          onChangeTone={setDistoTone}
          onChangeLevel={setDistoLevel}
          bypassed={bypassed.disto}
          onToggleBypass={() => toggle('disto')}
        />

        {/* Amp Head with integrated EQ */}
        <AmpPedal
          inputGain={state.inputGain}
          eqBass={state.eqBass}
          eqMid={state.eqMid}
          eqTreble={state.eqTreble}
          onChangeInputGain={setInputGain}
          onChangeBass={setEqBass}
          onChangeMid={setEqMid}
          onChangeTreble={setEqTreble}
        />

        {/* Chorus */}
        <ChorusPedal
          chorusRate={state.chorusRate}
          chorusDepth={state.chorusDepth}
          chorusMix={chorusMix}
          onChangeRate={setChorusRate}
          onChangeDepth={setChorusDepth}
          onChangeMix={setChorusMix}
          bypassed={bypassed.chorus}
          onToggleBypass={() => toggle('chorus')}
        />

        {/* Reverb */}
        <ReverbPedal
          reverbLevel={reverbLevel}
          reverbType={state.reverbType}
          onChangeReverb={setReverbLevel}
          onChangeType={setReverbType}
          bypassed={bypassed.reverb}
          onToggleBypass={() => toggle('reverb')}
        />

        {/* Master Volume */}
        <MasterVolPedal
          outputGain={state.outputGain}
          onChangeOutputGain={setOutputGain}
        />

        {/* VU Meter */}
        <Pedal id="level" name="Level">
          <VUMeter
            inputLevel={state.inputLevel}
            outputLevel={state.outputLevel}
            isActive={state.isActive}
          />
        </Pedal>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-status">
          {state.isActive
            ? <><strong>Garage Bro</strong> — Live</>
            : 'Press On to start'}
        </div>
      </footer>

    </div>
  )
}
