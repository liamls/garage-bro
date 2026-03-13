import { ReactNode } from 'react'

interface PedalProps {
    id: string
    name: string
    className?: string
    children: ReactNode
    bypassed?: boolean
    onToggleBypass?: () => void
}

export function Pedal({ id, name, className = '', children, bypassed = false, onToggleBypass }: PedalProps) {
    return (
        <div className={`pedal pedal-${id} ${className} ${bypassed ? 'pedal--bypassed' : ''}`.trim()}>
            <div className="pedal-header">
                <div className="pedal-name">{name}</div>
                {onToggleBypass && (
                    <button
                        className={`pedal-bypass ${bypassed ? 'pedal-bypass--off' : 'pedal-bypass--on'}`}
                        onClick={onToggleBypass}
                        title={bypassed ? 'Enable' : 'Bypass'}
                    />
                )}
            </div>
            {children}
        </div>
    )
}
