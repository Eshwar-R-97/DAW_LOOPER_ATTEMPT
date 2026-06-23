import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./store/useDawStore', () => {
  const mockState = {
    playbackState: 'idle' as const,
    clips: [],
    currentPosition: 0,
    timelineLength: 0,
    masterVolume: 1.0,
    error: null,
    engine: null,
    initializeEngine: vi.fn().mockResolvedValue(undefined),
    play: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    moveClip: vi.fn(),
    deleteClip: vi.fn(),
    setClipVolume: vi.fn(),
    toggleClipMute: vi.fn(),
    setClipReverb: vi.fn(),
    setClipPitch: vi.fn(),
    setMasterVolume: vi.fn(),
    dispose: vi.fn(),
  }

  return {
    useDawStore: Object.assign(
      (selector: (state: typeof mockState) => unknown) => selector(mockState),
      {
        getState: () => mockState,
        setState: vi.fn(),
        subscribe: vi.fn(),
      }
    ),
  }
})

describe('App', () => {
  it('renders DAW Host as the default shell', () => {
    render(<App />)
    expect(screen.getByText(/daw host/i)).toBeInTheDocument()
  })

  it('renders DAW transport controls by default', () => {
    render(<App />)
    expect(screen.getByLabelText(/record/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/play/i)).toBeInTheDocument()
  })
})
