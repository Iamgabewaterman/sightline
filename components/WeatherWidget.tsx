import { getWeather, weatherEmoji, weatherLabel } from "@/lib/weather";

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

interface Props {
  lat: number;
  lng: number;
  jobStatus: string;
}

export default async function WeatherWidget({ lat, lng, jobStatus }: Props) {
  const weather = await getWeather(lat, lng);
  if (!weather) return null;

  const showRainAlert =
    jobStatus === "active" && weather.precipNextDay >= 60;

  return (
    <div className="mb-4">
      {/* Rain alert banner */}
      {showRainAlert && (
        <div className="bg-orange-500/15 border border-orange-500/40 rounded-xl px-4 py-3 mb-2 flex items-center gap-2">
          <span className="text-lg">🌧️</span>
          <p className="text-orange-300 text-sm font-semibold">
            Rain expected — {weather.precipNextDay}% chance in next 24 hrs. Plan accordingly.
          </p>
        </div>
      )}

      {/* Weather card */}
      <div className="bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl px-5 py-4">
        {/* Current conditions row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{weatherEmoji(weather.currentCode)}</span>
            <div>
              <p className="text-white font-black text-2xl leading-none">{weather.currentTemp}°F</p>
              <p className="text-gray-400 text-sm mt-0.5">{weatherLabel(weather.currentCode)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-300 text-sm font-semibold">
              H: {weather.todayMax}° · L: {weather.todayMin}°
            </p>
            <p className="text-gray-600 text-xs mt-0.5">Today</p>
          </div>
        </div>

        {/* 3-day forecast */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#2a2a2a]">
          {weather.forecast.map((day) => (
            <div key={day.date} className="text-center">
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                {dayLabel(day.date)}
              </p>
              <span className="text-xl">{weatherEmoji(day.weatherCode)}</span>
              <p className="text-white text-xs font-semibold mt-1">
                {day.tempMax}° / {day.tempMin}°
              </p>
              {day.precipProbabilityMax > 20 && (
                <p className="text-blue-400 text-xs mt-0.5">{day.precipProbabilityMax}%</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
