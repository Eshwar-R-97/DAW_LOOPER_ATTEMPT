import { render, screen } from '@testing-library/react'
import App from './App'

// Mock the store to avoid initializing real audio engine
vi.mock('./store/useLooperStore', async () => {
  const types = await import('./types')

  const mockState = {
    looperState: types.LooperState.EMPTY,
    tracks: [],
    masterLoopLength: 0,
    currentPosition: 0,
    masterVolume: 1.0,
    error: null,
    canUndo: false,
    canRedo: false,
    engine: null,
    initializeEngine: vi.fn().mockResolvedValue(undefined),
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    playAll: vi.fn(),
    stopAll: vi.fn(),
    toggleTrackMute: vi.fn(),
    setTrackVolume: vi.fn(),
    setMasterVolume: vi.fn(),
    undoLastTrack: vi.fn(),
    redoTrack: vi.fn(),
    dispose: vi.fn(),
  }

  return {
    useLooperStore: Object.assign(
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
  it('renders without crashing', () => {
    render(<App />)
    expect(screen.getByText(/daw looper/i)).toBeInTheDocument()
  })

  it('renders the transport bar', () => {
    render(<App />)
    expect(screen.getByTestId('record-button')).toBeInTheDocument()
  })

  it('renders the empty state when no tracks', () => {
    render(<App />)
    expect(screen.getByText(/press record/i)).toBeInTheDocument()
  })

  it('renders the loop progress bar', () => {
    render(<App />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
