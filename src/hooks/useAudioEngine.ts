import { useState, useRef, useCallback, useEffect } from 'react'

export type ReverbType = 'spring' | 'hall'

export interface AudioState {
  isActive: boolean
  isLoading: boolean
  inputGain: number
  outputGain: number
  eqBass: number
  eqMid: number
  eqTreble: number
  reverbLevel: number
  reverbType: ReverbType
  chorusRate: number
  chorusDepth: number
  chorusMix: number
  distoDrive: number
  distoTone: number
  distoLevel: number
  tunerPitch: number | null
  tunerNote: string | null
  tunerCents: number | null
  inputDevices: MediaDeviceInfo[]
  outputDevices: MediaDeviceInfo[]
  selectedInputId: string
  selectedOutputId: string
  inputLevel: number
  outputLevel: number
  error: string | null
}

// ─── Tube Amp Waveshaper (drive-dependent) ───────────────────────────────────
// drive=0 → linear (clean), drive=10 → hard saturation
// k uses quadratic scaling so the clean zone is genuinely flat for the bottom half of the knob
function makeTubeAmpCurve(drive: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const c = new Float32Array(new ArrayBuffer(n * 4))
  // Quadratic k: at drive=3 k≈0.5 (barely warm), at drive=10 k=15 (lead)
  const k = Math.max(0.001, Math.pow(drive / 10, 2) * 15)
  const normFactor = Math.tanh(k) || 1
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1
    // Asymmetric: positive swing clips slightly harder (tube characteristic)
    const asymm = x >= 0 ? 1.0 : 0.88
    c[i] = (Math.tanh(k * x * asymm) / normFactor) * asymm
  }
  return c
}

// ─── Cabinet Impulse Responses ────────────────────────────────────────────────
function createCabinetBuffer(ctx: AudioContext): AudioBuffer {
  // Simulate a 4x12 cabinet: severe low/high roll-off (bandpass 100Hz - 6000Hz) with some resonance
  const sr = ctx.sampleRate
  const len = Math.ceil(sr * 0.05) // Very short IR (50ms)
  const buf = ctx.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const envelope = Math.exp(-i / (sr * 0.01)) // Fast decay
      // Complex oscillation mixing typical speaker resonant frequencies (~120Hz, ~2000Hz)
      const f1 = Math.sin(2 * Math.PI * 120 * i / sr)
      const f2 = Math.sin(2 * Math.PI * 2500 * i / sr)
      d[i] = (f1 * 0.4 + f2 * 0.6) * envelope * (Math.random() * 0.2 + 0.8)
    }
  }
  return buf
}

// ─── Reverb IRs ───────────────────────────────────────────────────────────────

function createHallBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.ceil(sr * 2.5) // longer tail
  const buf = ctx.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.5)
    }
  }
  return buf
}

function createSpringBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const len = Math.ceil(sr * 0.8) // snappy, short tail
  const buf = ctx.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      // Simulate metallic flutter with sine wave multiplication
      const envelope = Math.pow(1 - i / len, 2.0)
      const flutter  = Math.sin(i * 0.5) * 0.5 + 0.5
      d[i] = (Math.random() * 2 - 1) * envelope * flutter * 1.5
    }
  }
  return buf
}

// ─── Distortion Hard Clipper ──────────────────────────────────────────────────
function makeHardClipCurve(): Float32Array<ArrayBuffer> {
  const n = 1024
  const c = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1
    // Hard brutal clipping for distortion/fuzz
    c[i] = Math.max(-0.6, Math.min(0.6, x * 4)) 
  }
  return c
}

// ─── Pitch Detection (YIN algorithm simplified) ───────────────────────────────
function detectPitchYin(buffer: Float32Array, sampleRate: number): number | null {
  const threshold = 0.15
  const half = Math.floor(buffer.length / 2)
  const yinBuffer = new Float32Array(half)
  
  // Difference function
  for (let tau = 0; tau < half; tau++) {
    for (let i = 0; i < half; i++) {
      const delta = buffer[i] - buffer[i + tau]
      yinBuffer[tau] += delta * delta
    }
  }
  
  // Cumulative mean normalized difference
  yinBuffer[0] = 1
  let runningSum = 0
  for (let tau = 1; tau < half; tau++) {
    runningSum += yinBuffer[tau]
    yinBuffer[tau] *= tau / runningSum
  }
  
  // Absolute threshold
  let tauEstimate = -1
  for (let tau = 2; tau < half; tau++) {
    if (yinBuffer[tau] < threshold) {
      while (tau + 1 < half && yinBuffer[tau + 1] < yinBuffer[tau]) tau++
      tauEstimate = tau
      break
    }
  }
  
  if (tauEstimate === -1) {
    for (let tau = 2; tau < half; tau++) {
      if (yinBuffer[tau] < yinBuffer[tauEstimate === -1 ? 2 : tauEstimate]) tauEstimate = tau
    }
    if (yinBuffer[tauEstimate] >= 0.5) return null // Unreliable
  }
  
  // Parabolic interpolation
  let betterTau = tauEstimate
  if (tauEstimate > 0 && tauEstimate < half - 1) {
    const s0 = yinBuffer[tauEstimate - 1]
    const s1 = yinBuffer[tauEstimate]
    const s2 = yinBuffer[tauEstimate + 1]
    betterTau += (s2 - s0) / (2 * (2 * s1 - s2 - s0))
  }
  
  return sampleRate / betterTau
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
function pitchToNoteInfo(pitch: number): { note: string, cents: number } {
  const a4 = 440
  const c0 = a4 * Math.pow(2, -4.75) // ~16.35 Hz
  const halfSteps = Math.round(12 * Math.log2(pitch / c0))
  const expectedPitch = c0 * Math.pow(2, halfSteps / 12)
  const cents = Math.round(1200 * Math.log2(pitch / expectedPitch))
  const noteObj = NOTES[halfSteps % 12]
  return { note: noteObj, cents }
}

// ─── RMS / level ─────────────────────────────────────────────────────────────

function getRMS(analyser: AnalyserNode): number {
  const buf = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

function toDisplayLevel(rms: number): number {
  if (rms < 0.0001) return 0
  const db = 20 * Math.log10(rms)
  return Math.max(0, Math.min(1, (db + 60) / 60))
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AudioNodes {
  source?: MediaStreamAudioSourceNode
  inputGain?: GainNode
  inputAnalyser?: AnalyserNode
  distoInputGain?: GainNode
  distoShaper?: WaveShaperNode
  distoFilter?: BiquadFilterNode
  distoOutputGain?: GainNode
  waveShaper?: WaveShaperNode
  cabHPF?: BiquadFilterNode       // HPF 80 Hz — kill sub-bass rumble
  cab300cut?: BiquadFilterNode    // peaking -4 dB @ 300 Hz — reduce boxiness
  cabLPF?: BiquadFilterNode       // LPF 5 kHz — tame harshness
  postAmp?: GainNode
  chorusDry?: GainNode
  chorusWet?: GainNode
  chorusDelay?: DelayNode
  chorusLfo?: OscillatorNode
  chorusLfoGain?: GainNode
  chorusMix?: GainNode
  bassFilter?: BiquadFilterNode
  midFilter?: BiquadFilterNode
  trebleFilter?: BiquadFilterNode
  dryGain?: GainNode
  convolver?: ConvolverNode
  wetGain?: GainNode
  mixGain?: GainNode                 // sum dry+wet before stereo spread
  merger?: ChannelMergerNode         // explicit mono→stereo: input 0=L, input 1=R
  outputGain?: GainNode
  outputAnalyser?: AnalyserNode
}

// AudioContext.setSinkId is not in TS lib yet
type AudioContextWithSink = AudioContext & { setSinkId?: (id: string) => Promise<void> }

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioEngine() {
  const [state, setState] = useState<AudioState>({
    isActive: false,
    isLoading: false,
    inputGain: 1.0,
    outputGain: 0.8,
    eqBass: 0,
    eqMid: 0,
    eqTreble: 0,
    chorusRate: 1.5,
    chorusDepth: 0.002,
    chorusMix: 0,
    distoDrive: 0,
    distoTone: 0.5,
    distoLevel: 0,
    tunerPitch: null,
    tunerNote: null,
    tunerCents: null,
    reverbLevel: 0.15,
    reverbType: 'spring',
    inputDevices: [],
    outputDevices: [],
    selectedInputId: '',
    selectedOutputId: '',
    inputLevel: 0,
    outputLevel: 0,
    error: null,
  })

  const ctxRef    = useRef<AudioContextWithSink | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const nodes     = useRef<AudioNodes>({})
  const rafRef    = useRef<number | null>(null)
  const stateRef  = useRef(state)
  stateRef.current = state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const startRef  = useRef<() => Promise<void>>(async () => {})

  // ─── Devices ─────────────────────────────────────────────────────────────

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const inputs  = all.filter(d => d.kind === 'audioinput')
      const outputs = all.filter(d => d.kind === 'audiooutput')
      setState(prev => ({
        ...prev,
        inputDevices:  inputs,
        outputDevices: outputs,
        selectedInputId:  prev.selectedInputId  || inputs[0]?.deviceId  || '',
        selectedOutputId: prev.selectedOutputId || outputs[0]?.deviceId || '',
      }))
    } catch (e) {
      console.warn('enumerateDevices failed', e)
    }
  }, [])

  useEffect(() => {
    refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  // ─── Build graph ──────────────────────────────────────────────────────────

  const buildGraph = useCallback((ctx: AudioContext, stream: MediaStream, s: AudioState) => {
    Object.values(nodes.current).forEach(n => { try { n?.disconnect() } catch {} })

    const n = nodes.current

    n.source         = ctx.createMediaStreamSource(stream)
    n.inputGain      = ctx.createGain()
    n.inputAnalyser  = ctx.createAnalyser()
    n.postAmp        = ctx.createGain()
    n.bassFilter     = ctx.createBiquadFilter()
    n.midFilter      = ctx.createBiquadFilter()
    n.trebleFilter   = ctx.createBiquadFilter()
    n.dryGain        = ctx.createGain()
    n.convolver      = ctx.createConvolver()
    n.wetGain        = ctx.createGain()
    // Explicit mono→stereo: sum dry+wet into a mix gain, then feed both
    // channels of a ChannelMergerNode so L and R are identical.
    n.mixGain        = ctx.createGain()
    n.merger         = ctx.createChannelMerger(2)
    n.outputGain     = ctx.createGain()
    n.outputAnalyser = ctx.createAnalyser()

    // inputGain.gain is fixed — it sets the base level, not the waveshaper drive.
    // Drive is controlled purely by the waveshaper curve (makeTubeAmpCurve).
    n.inputGain.gain.value = 0.7
    n.inputAnalyser.fftSize = 2048
    n.inputAnalyser.smoothingTimeConstant = 0.5

    // Distortion Stage
    n.distoInputGain = ctx.createGain()
    n.distoShaper = ctx.createWaveShaper()
    n.distoFilter = ctx.createBiquadFilter()
    n.distoOutputGain = ctx.createGain()

    n.distoInputGain.gain.value = 1 + (s.distoDrive * 10) // boost into clipper
    n.distoShaper.oversample = '4x'
    n.distoShaper.curve = makeHardClipCurve()
    n.distoFilter.type = 'lowpass'
    n.distoFilter.frequency.value = 500 + (s.distoTone * 6000)
    n.distoOutputGain.gain.value = s.distoLevel

    // Amp Stage — drive-dependent saturation
    n.waveShaper = ctx.createWaveShaper()
    n.waveShaper.oversample = '4x'
    n.waveShaper.curve = makeTubeAmpCurve(s.inputGain)
    
    // Cabinet — 3 BiquadFilters (HPF + peaking cut + LPF) for classic guitar cab response
    n.cabHPF = ctx.createBiquadFilter()
    n.cabHPF.type = 'highpass'
    n.cabHPF.frequency.value = 80
    n.cabHPF.Q.value = 0.7

    n.cab300cut = ctx.createBiquadFilter()
    n.cab300cut.type = 'peaking'
    n.cab300cut.frequency.value = 300
    n.cab300cut.gain.value = -4
    n.cab300cut.Q.value = 1.0

    n.cabLPF = ctx.createBiquadFilter()
    n.cabLPF.type = 'lowpass'
    n.cabLPF.frequency.value = 5000
    n.cabLPF.Q.value = 0.7

    n.postAmp = ctx.createGain()
    n.postAmp.gain.value = 1.5

    // Chorus
    n.chorusDry = ctx.createGain()
    n.chorusWet = ctx.createGain()
    n.chorusDelay = ctx.createDelay()
    n.chorusLfo = ctx.createOscillator()
    n.chorusLfoGain = ctx.createGain()
    n.chorusMix = ctx.createGain()
    
    // Default chorus delay around 20ms
    n.chorusDelay.delayTime.value = 0.02
    
    // LFO controls the delayTime (Rate and Depth)
    n.chorusLfo.type = 'sine'
    n.chorusLfo.frequency.value = s.chorusRate
    n.chorusLfoGain.gain.value = s.chorusDepth
    n.chorusLfo.connect(n.chorusLfoGain)
    n.chorusLfoGain.connect(n.chorusDelay.delayTime)
    n.chorusLfo.start()

    n.chorusDry.gain.value = 1 - s.chorusMix
    n.chorusWet.gain.value = s.chorusMix

    n.bassFilter.type            = 'lowshelf'
    n.bassFilter.frequency.value = 250
    n.bassFilter.gain.value      = s.eqBass

    n.midFilter.type             = 'peaking'
    n.midFilter.frequency.value  = 1200
    n.midFilter.Q.value          = 1.2
    n.midFilter.gain.value       = s.eqMid

    n.trebleFilter.type            = 'highshelf'
    n.trebleFilter.frequency.value = 4000
    n.trebleFilter.gain.value      = s.eqTreble

    n.convolver.buffer   = s.reverbType === 'hall' ? createHallBuffer(ctx) : createSpringBuffer(ctx)
    n.dryGain.gain.value = 1 - s.reverbLevel
    n.wetGain.gain.value = s.reverbLevel

    n.outputGain.gain.value = s.outputGain
    n.outputAnalyser.fftSize = 256
    n.outputAnalyser.smoothingTimeConstant = 0.5

    // Wire up
    n.source.connect(n.inputGain)
    n.inputGain.connect(n.inputAnalyser)
    
    // Disto path
    n.inputAnalyser.connect(n.distoInputGain!)
    n.distoInputGain!.connect(n.distoShaper!)
    n.distoShaper!.connect(n.distoFilter!)
    n.distoFilter!.connect(n.distoOutputGain!)
    
    // Dry bypass — distoLevel=0 means 100% dry signal
    const dryDisto = ctx.createGain()
    dryDisto.gain.value = 1 - s.distoLevel  // 1 when disto off, 0 when full on
    n.inputAnalyser.connect(dryDisto)

    // Sum into Amp
    n.distoOutputGain!.connect(n.waveShaper!)
    dryDisto.connect(n.waveShaper!)

    // Amp -> Cabinet filters (HPF > 300cut > LPF)
    n.waveShaper!.connect(n.cabHPF!)
    n.cabHPF!.connect(n.cab300cut!)
    n.cab300cut!.connect(n.cabLPF!)
    n.cabLPF!.connect(n.postAmp!)

    // Into Chorus Split
    n.postAmp.connect(n.chorusDry!)
    n.postAmp.connect(n.chorusDelay!)
    n.chorusDelay!.connect(n.chorusWet!)
    
    // Sum Chorus
    n.chorusDry!.connect(n.chorusMix!)
    n.chorusWet!.connect(n.chorusMix!)

    // Into EQ
    n.chorusMix!.connect(n.bassFilter)
    n.bassFilter.connect(n.midFilter)
    n.midFilter.connect(n.trebleFilter)
    n.trebleFilter.connect(n.dryGain)
    n.trebleFilter.connect(n.convolver)
    n.dryGain.connect(n.mixGain!)
    n.convolver.connect(n.wetGain)
    n.wetGain.connect(n.mixGain!)
    // Duplicate the mono mix into both L (input 0) and R (input 1) of the merger
    n.mixGain!.connect(n.merger!, 0, 0)
    n.mixGain!.connect(n.merger!, 0, 1)
    
    // Mix directly to Output
    n.merger!.connect(n.outputGain)

    n.outputGain.connect(n.outputAnalyser)
    n.outputGain.connect(ctx.destination)
  }, [])

  // ─── Animation ───────────────────────────────────────────────────────────

  const animLoop = useCallback(() => {
    const n = nodes.current
    if (n.inputAnalyser && n.outputAnalyser) {
      const inL  = toDisplayLevel(getRMS(n.inputAnalyser))
      const outL = toDisplayLevel(getRMS(n.outputAnalyser))

      // Pitch detection on the raw input (YIN)
      let tunerNote: string | null = null
      let tunerCents: number | null = null
      let tunerPitch: number | null = null
      if (ctxRef.current && inL > 0.05) {
        const fftBuf = new Float32Array(n.inputAnalyser.fftSize)
        n.inputAnalyser.getFloatTimeDomainData(fftBuf)
        const pitch = detectPitchYin(fftBuf, ctxRef.current.sampleRate)
        if (pitch && pitch > 40 && pitch < 1200) {
          tunerPitch = pitch
          const info = pitchToNoteInfo(pitch)
          tunerNote  = info.note
          tunerCents = info.cents
        }
      }

      setState(prev => {
        const levelsChanged = Math.abs(inL - prev.inputLevel) >= 0.015 || Math.abs(outL - prev.outputLevel) >= 0.015
        const tunerChanged  = tunerNote !== prev.tunerNote || tunerCents !== prev.tunerCents
        if (!levelsChanged && !tunerChanged) return prev
        return { ...prev, inputLevel: inL, outputLevel: outL, tunerPitch, tunerNote, tunerCents }
      })
    }
    rafRef.current = requestAnimationFrame(animLoop)
  }, [])

  // ─── Start ───────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: stateRef.current.selectedInputId
            ? { exact: stateRef.current.selectedInputId }
            : undefined,
          echoCancellation:  false,
          noiseSuppression:  false,
          autoGainControl:   false,
          // Request minimum latency from the OS
          // @ts-expect-error latency constraint not in TS lib
          latency:           { ideal: 0.003, max: 0.02 },
          sampleRate:        { ideal: 48000 },
          channelCount:      { ideal: 1 },
        },
      })

      // Minimal latency hint to guarantee fast base performance
      const ctx: AudioContextWithSink = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 48000,
      })

      ctxRef.current    = ctx
      streamRef.current = stream

      buildGraph(ctx, stream, stateRef.current)

      // Route output to selected device via AudioContext.setSinkId (Chrome 110+)
      if (stateRef.current.selectedOutputId && ctx.setSinkId) {
        try { await ctx.setSinkId(stateRef.current.selectedOutputId) } catch (e) { console.warn('setSinkId failed:', e) }
      }

      await refreshDevices()

      setState(prev => ({ ...prev, isActive: true, isLoading: false }))
      rafRef.current = requestAnimationFrame(animLoop)
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to access audio device',
      }))
    }
  }, [buildGraph, animLoop, refreshDevices])
  startRef.current = start

  // ─── Stop ────────────────────────────────────────────────────────────────

  const stop = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    Object.values(nodes.current).forEach(n => { try { n?.disconnect() } catch {} })
    nodes.current = {}
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    ctxRef.current?.close()
    ctxRef.current = null
    setState(prev => ({ ...prev, isActive: false, inputLevel: 0, outputLevel: 0 }))
  }, [])

  useEffect(() => () => { stop() }, [stop])

  // ─── Setters ─────────────────────────────────────────────────────────────

  const setInputGain = useCallback((v: number) => {
    setState(p => ({ ...p, inputGain: v }))
    // Only update the waveshaper curve — inputGain node stays at fixed 0.7
    if (nodes.current.waveShaper) nodes.current.waveShaper.curve = makeTubeAmpCurve(v)
  }, [])
  const setOutputGain  = useCallback((v: number) => { setState(p => ({ ...p, outputGain:  v })); if (nodes.current.outputGain)  nodes.current.outputGain.gain.value   = v }, [])
  const setEqBass      = useCallback((v: number) => { setState(p => ({ ...p, eqBass:      v })); if (nodes.current.bassFilter)  nodes.current.bassFilter.gain.value   = v }, [])
  const setEqMid       = useCallback((v: number) => { setState(p => ({ ...p, eqMid:       v })); if (nodes.current.midFilter)   nodes.current.midFilter.gain.value    = v }, [])
  const setEqTreble    = useCallback((v: number) => { setState(p => ({ ...p, eqTreble:    v })); if (nodes.current.trebleFilter) nodes.current.trebleFilter.gain.value = v }, [])

  const setChorusRate = useCallback((v: number) => { 
    setState(p => ({ ...p, chorusRate: v }))
    if (nodes.current.chorusLfo) nodes.current.chorusLfo.frequency.value = v 
  }, [])

  const setChorusDepth = useCallback((v: number) => { 
    setState(p => ({ ...p, chorusDepth: v }))
    if (nodes.current.chorusLfoGain) nodes.current.chorusLfoGain.gain.value = v 
  }, [])

  const setChorusMix = useCallback((v: number) => { 
    setState(p => ({ ...p, chorusMix: v }))
    if (nodes.current.chorusDry) nodes.current.chorusDry.gain.value = 1 - v
    if (nodes.current.chorusWet) nodes.current.chorusWet.gain.value = v
  }, [])

  const setDistoDrive = useCallback((v: number) => { 
    setState(p => ({ ...p, distoDrive: v }))
    if (nodes.current.distoInputGain) nodes.current.distoInputGain.gain.value = 1 + (v * 10) 
  }, [])

  const setDistoTone = useCallback((v: number) => { 
    setState(p => ({ ...p, distoTone: v }))
    if (nodes.current.distoFilter) nodes.current.distoFilter.frequency.value = 500 + (v * 6000) 
  }, [])

  const setDistoLevel = useCallback((v: number) => { 
    setState(p => ({ ...p, distoLevel: v }))
    // Wait: changing just distoLevel in real time is slightly complex without storing the bypass node ref,
    // so we re-trigger graph recreation if it's vastly simpler, or rebuild graph.
    // For extreme simplicity, we rebuild graph for state change.
    if (ctxRef.current && streamRef.current) {
        buildGraph(ctxRef.current, streamRef.current, { ...stateRef.current, distoLevel: v })
    }
  }, [buildGraph])

  const setReverbLevel = useCallback((v: number) => {
    setState(p => ({ ...p, reverbLevel: v }))
    if (nodes.current.dryGain) nodes.current.dryGain.gain.value = 1 - v
    if (nodes.current.wetGain) nodes.current.wetGain.gain.value = v
  }, [])

  const setReverbType = useCallback((type: ReverbType) => {
    setState(p => ({ ...p, reverbType: type }))
    if (ctxRef.current && nodes.current.convolver) {
      nodes.current.convolver.buffer = type === 'hall' 
        ? createHallBuffer(ctxRef.current) 
        : createSpringBuffer(ctxRef.current)
    }
  }, [])

  const setInputDevice = useCallback(async (deviceId: string) => {
    setState(p => ({ ...p, selectedInputId: deviceId }))
    if (!ctxRef.current || !streamRef.current) return
    streamRef.current.getTracks().forEach(t => t.stop())
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
          // @ts-expect-error latency constraint not in TS lib
          latency: { ideal: 0.003, max: 0.02 },
        },
      })
      streamRef.current = newStream
      buildGraph(ctxRef.current, newStream, { ...stateRef.current, selectedInputId: deviceId })
    } catch (e) { console.error('Input device switch failed', e) }
  }, [buildGraph])

  const setOutputDevice = useCallback(async (deviceId: string) => {
    setState(p => ({ ...p, selectedOutputId: deviceId }))
    const ctx = ctxRef.current
    if (ctx?.setSinkId && deviceId) {
      try { await ctx.setSinkId(deviceId) } catch (e) { console.warn('setSinkId failed:', e) }
    }
  }, [])

  return {
    state,
    start, stop,
    setInputGain, setOutputGain,
    setEqBass, setEqMid, setEqTreble,
    setChorusRate, setChorusDepth, setChorusMix,
    setDistoDrive, setDistoTone, setDistoLevel,
    setReverbLevel, setReverbType,
    setInputDevice, setOutputDevice,
    refreshDevices,
  }
}
