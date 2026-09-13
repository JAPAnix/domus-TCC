import logo from '../assets/logodomos.png.png';

export default function BrandLogo({ className = '' }) {
  return (
    <span className={`relative block h-9 w-28 overflow-hidden ${className}`}>
      <img
        src={logo}
        alt="Dommos"
        className="absolute left-1/2 top-1/2 h-[72px] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}
