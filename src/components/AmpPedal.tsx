import { Knob } from './Knob'
import { Pedal } from './Pedal'

interface AmpPedalProps {
    inputGain: number
    eqBass: number
    eqMid: number
    eqTreble: number
    onChangeInputGain: (val: number) => void
    onChangeBass: (val: number) => void
    onChangeMid: (val: number) => void
    onChangeTreble: (val: number) => void
}

export function AmpPedal({
    inputGain,
    eqBass, eqMid, eqTreble,
    onChangeInputGain,
    onChangeBass, onChangeMid, onChangeTreble,
}: AmpPedalProps) {
    return (
        <Pedal id="amp" name="Amp Head">
            <div className="amp-controls">
                <Knob value={inputGain} min={0} max={10} label="Gain" onChange={onChangeInputGain} size={64} />
                <div className="amp-divider" />
                <Knob value={eqBass} min={-12} max={12} label="Bass" unit="dB" onChange={onChangeBass} size={46} />
                <Knob value={eqMid} min={-12} max={12} label="Mid" unit="dB" onChange={onChangeMid} size={46} />
                <Knob value={eqTreble} min={-12} max={12} label="Treble" unit="dB" onChange={onChangeTreble} size={46} />
            </div>
        </Pedal>
    )
}
