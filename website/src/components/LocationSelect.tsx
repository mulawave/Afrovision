"use client";

import { countries, getStates, getCities } from "@/lib/locations";

interface LocationSelectProps {
  country: string;
  state: string;
  city: string;
  onCountryChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
}

export function LocationSelect({
  country,
  state,
  city,
  onCountryChange,
  onStateChange,
  onCityChange,
}: LocationSelectProps) {
  const states = getStates(country);
  const cities = getCities(country, state);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
          Country
        </label>
        <select
          value={country}
          onChange={(e) => {
            onCountryChange(e.target.value);
            onStateChange("");
            onCityChange("");
          }}
          className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none"
          required
        >
          <option value="">Select country</option>
          {countries.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
          State
        </label>
        <select
          value={state}
          onChange={(e) => {
            onStateChange(e.target.value);
            onCityChange("");
          }}
          disabled={!country}
          className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none disabled:opacity-40"
          required
        >
          <option value="">Select state</option>
          {states.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-av-light-orange mb-1.5">
          City
        </label>
        <select
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          disabled={!state}
          className="w-full rounded-xl border border-av-input-border/30 bg-av-input-fill/50 px-4 py-3 text-sm text-av-white focus:border-av-orange/50 focus:outline-none disabled:opacity-40"
          required
        >
          <option value="">Select city</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
