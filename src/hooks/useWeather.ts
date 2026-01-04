import { useState, useEffect } from 'react';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  description: string;
  emoji: string;
  city: string;
  isLoading: boolean;
  error: string | null;
}

// Weather codes from Open-Meteo API
const getWeatherInfo = (code: number): { description: string; emoji: string } => {
  // Clear sky
  if (code === 0) return { description: 'klart', emoji: '☀️' };
  // Mainly clear, partly cloudy
  if (code === 1) return { description: 'mestadels klart', emoji: '🌤️' };
  if (code === 2) return { description: 'halvklart', emoji: '⛅' };
  if (code === 3) return { description: 'molnigt', emoji: '☁️' };
  // Fog
  if (code === 45 || code === 48) return { description: 'dimma', emoji: '🌫️' };
  // Drizzle
  if (code >= 51 && code <= 57) return { description: 'duggregn', emoji: '🌧️' };
  // Rain
  if (code >= 61 && code <= 67) return { description: 'regn', emoji: '🌧️' };
  // Snow
  if (code >= 71 && code <= 77) return { description: 'snö', emoji: '❄️' };
  // Rain showers
  if (code >= 80 && code <= 82) return { description: 'regnskurar', emoji: '🌦️' };
  // Snow showers
  if (code >= 85 && code <= 86) return { description: 'snöbyar', emoji: '🌨️' };
  // Thunderstorm
  if (code >= 95 && code <= 99) return { description: 'åska', emoji: '⛈️' };
  
  return { description: 'okänt', emoji: '🌡️' };
};

// Reverse geocoding to get city name
const getCityName = async (lat: number, lon: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=sv`
    );
    const data = await response.json();
    
    // Try to get the most specific location name
    const city = data.address?.city || 
                 data.address?.town || 
                 data.address?.municipality ||
                 data.address?.village ||
                 data.address?.suburb ||
                 data.address?.county ||
                 'din plats';
    
    return city;
  } catch {
    return 'din plats';
  }
};

export const useWeather = (): WeatherData => {
  const [weather, setWeather] = useState<WeatherData>({
    temperature: 0,
    weatherCode: 0,
    description: '',
    emoji: getTimeBasedEmoji(),
    city: '',
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchWeather = async () => {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        setWeather(prev => ({
          ...prev,
          isLoading: false,
          emoji: getTimeBasedEmoji(),
          error: 'Geolocation not supported',
        }));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Fetch weather and city name in parallel
            const [weatherResponse, city] = await Promise.all([
              fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
              ),
              getCityName(latitude, longitude),
            ]);

            const weatherData = await weatherResponse.json();
            const currentWeather = weatherData.current_weather;
            const weatherInfo = getWeatherInfo(currentWeather.weathercode);

            setWeather({
              temperature: Math.round(currentWeather.temperature),
              weatherCode: currentWeather.weathercode,
              description: weatherInfo.description,
              emoji: weatherInfo.emoji,
              city,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            console.error('Weather fetch error:', error);
            setWeather(prev => ({
              ...prev,
              isLoading: false,
              emoji: getTimeBasedEmoji(),
              error: 'Failed to fetch weather',
            }));
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setWeather(prev => ({
            ...prev,
            isLoading: false,
            emoji: getTimeBasedEmoji(),
            error: 'Location access denied',
          }));
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    };

    fetchWeather();
  }, []);

  return weather;
};

// Fallback emoji based on time of day
function getTimeBasedEmoji(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 18) return '👋';
  return '🌙';
}
