import logo from '../assets/logo/logo.webp'

export default function Splash() {
  return (
    <div className="grid min-h-svh place-items-center bg-cream" role="status" aria-label="Loading">
      <img src={logo} alt="" width="2114" height="744" className="h-10 w-auto animate-pulse motion-reduce:animate-none" />
    </div>
  )
}
