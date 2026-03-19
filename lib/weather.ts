export interface WeatherDay {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipProbabilityMax: number;
}

export interface WeatherData {
  currentTemp: number;
  currentCode: number;
  todayMax: number;
  todayMin: number;
  forecast: WeatherDay[]; // next 3 days (indices 1-3)
  precipNextDay: number;  // max precip probability in next ~24h
}

export function weatherLabel(code: number): string {
  if (code === 0) return "Sunny";
  if (code <= 2) return "Partly Cloudy";
  if (code === 3) return "Cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow Showers";
  return "Thunderstorm";
}

export function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// In-memory cache — good enough for serverless with instance reuse
const memCache = new Map<string, { data: WeatherData; ts: number }>();

async function fetchFromOpenMeteo(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&current=temperature_2m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&temperature_unit=fahrenheit&timezone=auto&forecast_days=4`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();

    const currentTemp = Math.round(json.current.temperature_2m);
    const currentCode = json.current.weather_code;

    const daily = json.daily;
    const todayMax = Math.round(daily.temperature_2m_max[0]);
    const todayMin = Math.round(daily.temperature_2m_min[0]);

    const forecast: WeatherDay[] = [];
    for (let i = 1; i <= 3; i++) {
      forecast.push({
        date: daily.time[i],
        weatherCode: daily.weather_code[i],
        tempMax: Math.round(daily.temperature_2m_max[i]),
        tempMin: Math.round(daily.temperature_2m_min[i]),
        precipProbabilityMax: daily.precipitation_probability_max[i] ?? 0,
      });
    }

    const precipNextDay = Math.max(
      daily.precipitation_probability_max[0] ?? 0,
      daily.precipitation_probability_max[1] ?? 0
    );

    return { currentTemp, currentCode, todayMax, todayMin, forecast, precipNextDay };
  } catch {
    return null;
  }
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData | null> {
  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = memCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetchFromOpenMeteo(lat, lng);
  if (data) memCache.set(key, { data, ts: Date.now() });
  return data;
}
