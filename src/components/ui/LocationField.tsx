import { useEffect, useState } from "react";
import LocationPickerMap from "../map/LocationPickerMap";
import "../map/mapStyles.css";

type Location = { lat: number; lng: number };

type Props = {
  value: Location | null;
  originalValue: Location | null;
  onChange: (location: Location | null) => void;
  disabled?: boolean;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const formatCoord = (loc: Location | null) =>
  loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : "—";

export default function LocationField({
  value,
  originalValue,
  onChange,
  disabled,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          trimmed,
        )}&format=json&limit=5&addressdetails=0`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as NominatimResult[];
        setSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSearchError("Couldn't search addresses");
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handlePickSuggestion = (result: NominatimResult) => {
    const lat = Number.parseFloat(result.lat);
    const lng = Number.parseFloat(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    onChange({ lat, lng });
    setQuery("");
    setSuggestions([]);
    setSearchError(null);
  };

  const canRemove = value !== null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b4658]">
          Location
        </label>
        {canRemove && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="cursor-pointer rounded-full bg-[#ffebeb] px-2.5 py-1 text-[10px] font-semibold text-[#8a2222] transition hover:bg-[#ffd9d9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove pin
          </button>
        )}
      </div>

      <div className="relative z-50">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[0]) {
              e.preventDefault();
              handlePickSuggestion(suggestions[0]);
            }
          }}
          placeholder="Search address or place..."
          autoComplete="off"
          disabled={disabled}
          className="w-full rounded-xl border border-[#ecd6d6] bg-white px-4 py-2 pr-24 text-sm text-[#333] shadow-sm transition-all duration-200 focus:border-[#F7DEE2] focus:outline-none focus:ring-2 focus:ring-[#F7DEE2]/35 disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
        />
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#b89099]">
            Searching...
          </span>
        )}
        {searchError && !isSearching && (
          <p className="mt-1 text-[11px] text-[#8a2222]">{searchError}</p>
        )}
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#ecd6d6] bg-white shadow-lg"
          >
            {suggestions.map((s) => (
              <li key={s.place_id}>
                <button
                  type="button"
                  onClick={() => handlePickSuggestion(s)}
                  className="block w-full cursor-pointer px-3 py-2 text-left text-xs text-[#333] transition hover:bg-[#fff6f9]"
                >
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative z-0 h-[260px] w-full overflow-hidden rounded-2xl border border-[#f1d8df]">
        <LocationPickerMap value={value} onChange={(loc) => onChange(loc)} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-[#7a6970]">
        <p>
          <span className="font-semibold text-[#333]">Current:</span>{" "}
          {formatCoord(originalValue)}
        </p>
        <p>
          <span className="font-semibold text-[#333]">Pending:</span>{" "}
          {formatCoord(value)}
        </p>
      </div>
    </div>
  );
}
