"use client";

import Link from "next/link";
import { useState } from "react";
import { weatherEmoji, weatherLabel } from "@/lib/weather";
import type { WeatherData } from "@/lib/weather";

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

interface Props {
  weather: WeatherData | null;
  city: string | null;
}

export default function DashboardWeatherBar({ weather, city }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!weather) {
    return (
      <Link
        href="/business-profile"
        className="flex items-center h-9 px-3 mb-4 rounded-xl bg-[#1A1A1A] border border-[#2a2a2a] text-gray-500 text-xs active:opacity-70"
      >
        Set your location in Settings for local weather →
      </Link>
    );
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center h-9 px-3 rounded-xl bg-[#1A1A1A] border border-[#2a2a2a] active:opacity-80 transition-opacity"
      >
        <span className="text-base leading-none mr-1.5">{weatherEmoji(weather.currentCode)}</span>
        <span className="text-white font-bold text-sm mr-1.5">{weather.currentTemp}°F</span>
        <span className="text-gray-400 text-sm">{weatherLabel(weather.currentCode)}</span>
        {city && <span className="ml-auto text-gray-500 text-xs truncate max-w-[120px]">{city}</span>}
        <span className="ml-2 text-gray-600 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {weather.forecast.map((day) => (
            <div key={day.date} className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-2 py-2.5 text-center">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">{dayLabel(day.date)}</p>
              <span className="text-xl">{weatherEmoji(day.weatherCode)}</span>
              <p className="text-white text-xs font-semibold mt-1">{day.tempMax}° / {day.tempMin}°</p>
              {day.precipProbabilityMax > 20 && (
                <p className="text-blue-400 text-xs mt-0.5">{day.precipProbabilityMax}%</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
