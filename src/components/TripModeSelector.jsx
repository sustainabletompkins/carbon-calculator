import { Car, Plane } from 'lucide-react'

const TripModeSelector = ({ tripMode, setTripMode }) => {
  const modes = [
    { id: 'car', label: 'Car', icon: <Car /> },
    { id: 'plane', label: 'Plane', icon: <Plane /> },
  ]

  return (
    <div className="flex justify-center mb-8">
      <div className="flex rounded-lg bg-gray-200 p-1">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setTripMode(mode.id)}
            className={`flex items-center justify-center w-32 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              tripMode === mode.id
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-600 hover:bg-gray-300'
            }`}
          >
            {mode.icon}
            <span className="ml-2">{mode.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default TripModeSelector