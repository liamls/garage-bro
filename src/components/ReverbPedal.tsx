import { Knob } from './Knob'
import { Pedal } from './Pedal'
import { ReverbType } from '../hooks/useAudioEngine'

interface ReverbPedalProps {
    reverbLevel: number
    reverbType: ReverbType
    onChangeReverb: (val: number) => void
    onChangeType: (type: ReverbType) => void
    bypassed?: boolean
    onToggleBypass?: () => void
}

export function ReverbPedal({ reverbLevel, reverbType, onChangeReverb, onChangeType, bypassed, onToggleBypass }: ReverbPedalProps) {
    return (
        <Pedal id="reverb" name="Reverb" bypassed={bypassed} onToggleBypass={onToggleBypass}>
            <div className="reverb-controls">
                <div className="reverb-type-switch">
                    <button
                        className={`type-btn ${reverbType === 'spring' ? 'active' : ''}`}
                        onClick={() => onChangeType('spring')}
                    >
                        Spring
                    </button>
                    <button
                        className={`type-btn ${reverbType === 'hall' ? 'active' : ''}`}
                        onClick={() => onChangeType('hall')}
                    >
                        Hall
                    </button>
                </div>
                <Knob value={reverbLevel} min={0} max={1} label="Mix" onChange={onChangeReverb} size={70} />
            </div>
        </Pedal>
    )
}
