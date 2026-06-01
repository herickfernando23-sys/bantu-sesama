import { ImageWithFallback } from './ImageWithFallback';
import { MapPin, Users, TrendingUp } from 'lucide-react';

interface CampaignCardProps {
  id: number;
  title: string;
  description: string;
  image: string;
  location: string;
  target: number;
  goal?: number;
  collected: number;
  donors: number;
  daysLeft: number;
  category: string;
  onClick: () => void;
}

export function CampaignCard({
  title,
  description,
  image,
  location,
  target,
  goal,
  collected,
  donors,
  daysLeft,
  category,
  onClick
}: CampaignCardProps) {
  const effectiveTarget = target > 0 ? target : (goal ?? 0);
  const percentage = effectiveTarget > 0 ? Math.min((collected / effectiveTarget) * 100, 100) : 0;

  return (
    <div
      className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden border border-gray-100"
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden">
        <ImageWithFallback
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 bg-blue-600 text-white text-sm rounded-full">
            {category}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="px-3 py-1 bg-white text-gray-900 text-sm rounded-full font-medium">
            {daysLeft} hari lagi
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
          {title}
        </h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {description}
        </p>

        <div className="flex items-center gap-1 text-gray-500 text-sm mb-4">
          <MapPin className="w-4 h-4" />
          <span>{location}</span>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Terkumpul</span>
            <span className="font-medium text-blue-600">{percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold text-gray-900">
              Rp {collected.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-gray-500">
              dari Rp {(effectiveTarget).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="flex items-center gap-1 text-gray-600 text-sm">
            <Users className="w-4 h-4" />
            <span>{donors} donatur</span>
          </div>
        </div>
      </div>
    </div>
  );
}
