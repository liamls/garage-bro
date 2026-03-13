import { Knob } from './Knob'
import { Pedal } from './Pedal'

interface DistoPedalProps {
    distoDrive: number
    distoTone: number
    distoLevel: number
    onChangeDrive: (val: number) => void
    onChangeTone: (val: number) => void
    onChangeLevel: (val: number) => void
    bypassed?: boolean
    onToggleBypass?: () => void
}

export function DistoPedal({
    distoDrive,
    distoTone,
    distoLevel,
    onChangeDrive,
    onChangeTone,
    onChangeLevel,
    bypassed,
    onToggleBypass,
}: DistoPedalProps) {
    return (
        <Pedal id="disto" name="Distortion" bypassed={bypassed} onToggleBypass={onToggleBypass}>
            <div className="knob-row">
                <Knob
                    value={distoDrive}
                    label="Drive"
                    onChange={onChangeDrive}
                    min={0}
                    max={1}
                    size={50}
                />
                <Knob
                    value={distoTone}
                    label="Tone"
                    onChange={onChangeTone}
                    min={0}
                    max={1}
                    size={50}
                />
                <Knob
                    value={distoLevel}
                    label="Level"
                    onChange={onChangeLevel}
                    min={0}
                    max={1}
                    size={50}
                />
            </div>
        </Pedal>
    )
}
