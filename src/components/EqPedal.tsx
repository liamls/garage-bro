import { Knob } from './Knob'
import { Pedal } from './Pedal'

interface EqPedalProps {
    eqBass: number
    eqMid: number
    eqTreble: number
    onChangeBass: (val: number) => void
    onChangeMid: (val: number) => void
    onChangeTreble: (val: number) => void
}

export function EqPedal({
    eqBass,
    eqMid,
    eqTreble,
    onChangeBass,
    onChangeMid,
    onChangeTreble,
}: EqPedalProps) {
    return (
        <Pedal id="eq" name="EQ">
            <div className="knob-row">
                <Knob value={eqBass} min={-12} max={12} label="Bass" unit="dB" onChange={onChangeBass} size={56} />
                <Knob value={eqMid} min={-12} max={12} label="Mid" unit="dB" onChange={onChangeMid} size={56} />
                <Knob value={eqTreble} min={-12} max={12} label="Treble" unit="dB" onChange={onChangeTreble} size={56} />
            </div>
        </Pedal>
    )
}
