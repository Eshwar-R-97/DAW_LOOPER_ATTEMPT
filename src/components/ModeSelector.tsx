interface ModeSelectorProps {
  mode: 'looper' | 'daw'
  onChange: (mode: 'looper' | 'daw') => void
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <button
        className={`mode-btn${mode === 'looper' ? ' active' : ''}`}
        onClick={() => onChange('looper')}
      >
        Looper
      </button>
      <button
        className={`mode-btn${mode === 'daw' ? ' active' : ''}`}
        onClick={() => onChange('daw')}
      >
        DAW
      </button>
    </div>
  )
}
