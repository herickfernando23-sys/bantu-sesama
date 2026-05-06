export function Logo({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-2 text-left ${className}`}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="20" fill="#3B82F6"/>
        <path d="M20 8L12 16H16V24H14L20 32L26 24H24V16H28L20 8Z" fill="white"/>
        <circle cx="20" cy="20" r="3" fill="#FCD34D"/>
      </svg>
      <span className="font-bold text-xl text-gray-900">BantuSesama</span>
    </button>
  );
}
