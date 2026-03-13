import { Knob } from './Knob'
import { Pedal } from './Pedal'

interface MasterVolPedalProps {
    outputGain: number
    onChangeOutputGain: (val: number) => void
}

export function MasterVolPedal({ outputGain, onChangeOutputGain }: MasterVolPedalProps) {
    return (
        <Pedal id="master" name="Master">
            <Knob value={outputGain} min={0} max={10} label="Vol" onChange={onChangeOutputGain} size={64} />
        </Pedal>
    )
}
