import { DawView } from './components/DawView'
import { LooperView } from './components/LooperView'
import { isLooperDevMode } from './dev/isLooperDevMode'

function App() {
  const showLooper = isLooperDevMode()

  return (
    <div className="app">
      <header className="app-header">
        <h1>{showLooper ? 'DAW Looper (dev)' : 'DAW Host'}</h1>
      </header>

      {showLooper ? <LooperView /> : <DawView />}
    </div>
  )
}

export default App
