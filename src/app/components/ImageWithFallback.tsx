import { useState } from 'react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
}

const colorMap: Record<string, string> = {
  'Baksop': 'from-amber-600 to-amber-700',
  'Warung': 'from-red-500 to-red-600',
  'Jahit': 'from-pink-500 to-pink-600',
  'Pedagang': 'from-blue-500 to-blue-600',
  'Kelontong': 'from-teal-500 to-teal-600',
  'Koperasi': 'from-green-600 to-green-700',
};

export function ImageWithFallback({ src, alt, className = '' }: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  // Get color based on alt text for fallback only
  let colorClass = 'from-gray-400 to-gray-500';
  for (const [key, color] of Object.entries(colorMap)) {
    if (alt.includes(key)) {
      colorClass = color;
      break;
    }
  }

  if (!src) {
    return (
      <div className={`bg-gradient-to-br ${colorClass} flex items-center justify-center ${className}`}>
        <span className="text-white text-center text-lg font-semibold px-4">{alt}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-gradient-to-br ${colorClass} flex items-center justify-center ${className}`}>
        <span className="text-white text-center text-lg font-semibold px-4">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      onLoad={() => { try { console.debug('Image loaded:', src); } catch {} }}
      loading="lazy"
    />
  );
}
