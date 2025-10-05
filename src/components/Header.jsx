import { Leaf } from 'lucide-react'

const Header = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <Leaf className="text-green-500" size={32} />
        <h1 className="text-xl font-bold ml-2">Carbon Offset Calculator</h1>
      </div>
    </header>
  )
}

export default Header