import { Knob } from './Knob'
import { Pedal } from './Pedal'

interface ChorusPedalProps {
    chorusRate: number
    chorusDepth: number
    chorusMix: number
    onChangeRate: (val: number) => void
    onChangeDepth: (val: number) => void
    onChangeMix: (val: number) => void
    bypassed?: boolean
    onToggleBypass?: () => void
}

export function ChorusPedal({
    chorusRate,
    chorusDepth,
    chorusMix,
    onChangeRate,
    onChangeDepth,
    onChangeMix,
    bypassed,
    onToggleBypass,
}: ChorusPedalProps) {
    return (
        <Pedal id="chorus" name="Chorus" bypassed={bypassed} onToggleBypass={onToggleBypass}>
            <div className="knob-row">
                <Knob value={chorusRate} min={0.1} max={5} label="Rate" unit="Hz" onChange={onChangeRate} size={50} />
                <Knob value={chorusDepth * 1000} min={0} max={10} label="Depth" unit="ms" onChange={(v) => onChangeDepth(v / 1000)} size={50} />
                <Knob value={chorusMix} min={0} max={1} label="Mix" onChange={onChangeMix} size={50} />
            </div>
        </Pedal>
    )
}
