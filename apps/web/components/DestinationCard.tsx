import React from 'react';
import Image from 'next/image';

interface DestinationCardProps {
  name: string;
  country: string;
  imageUrl: string;
  description: string;
}

export function DestinationCard({ name, country, imageUrl, description }: DestinationCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-3xl cursor-pointer transition-transform hover:scale-105 duration-300">
      <div className="relative h-80 w-full">
        <Image
          src={imageUrl}
          alt={`${name}, ${country}`}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
        <h3 className="text-2xl font-bold mb-1">{name}</h3>
        <p className="text-sm text-gray-300 mb-2">{country}</p>
        <p className="text-sm text-gray-200 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {description}
        </p>
      </div>
      
      <div className="absolute top-4 right-4 bg-[#ec7a1c] text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
        Explore
      </div>
    </div>
  );
}
