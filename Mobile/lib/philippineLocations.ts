const PSGC_BASE_URL = 'https://psgc.gitlab.io/api';
const LOCATION_TIMEOUT_MS = 8000;

export type ProvinceOption = { code: string; name: string };
export type CityOption = { code: string; name: string; provinceCode?: string };
export type BarangayOption = { code: string; name: string };

let locationOptionsPromise: Promise<{ provinces: ProvinceOption[]; cities: CityOption[] }> | null = null;
const barangayPromises = new Map<string, Promise<BarangayOption[]>>();

const fetchLocationJson = async (path: string): Promise<any[]> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), LOCATION_TIMEOUT_MS);
  try {
    const response = await fetch(`${PSGC_BASE_URL}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Location service returned ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Location service returned invalid data.');
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Location options took too long to load.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export const getPhilippineLocationOptions = async () => {
  if (!locationOptionsPromise) {
    locationOptionsPromise = Promise.all([
      fetchLocationJson('/provinces/'),
      fetchLocationJson('/cities-municipalities/'),
    ])
      .then(([provinceData, cityData]) => ({
        provinces: provinceData
          .map((item) => ({ code: String(item?.code || ''), name: String(item?.name || '').trim() }))
          .filter((item) => item.code && item.name)
          .sort(byName),
        cities: cityData
          .map((item) => ({
            code: String(item?.code || ''),
            name: String(item?.name || '').trim(),
            provinceCode: item?.provinceCode ? String(item.provinceCode) : undefined,
          }))
          .filter((item) => item.code && item.name)
          .sort(byName),
      }))
      .catch((error) => {
        locationOptionsPromise = null;
        throw error;
      });
  }
  return locationOptionsPromise;
};

export const getPhilippineBarangays = async (cityCode: string) => {
  const normalizedCode = String(cityCode || '').trim();
  if (!normalizedCode) return [];
  if (!barangayPromises.has(normalizedCode)) {
    const promise = fetchLocationJson(`/cities-municipalities/${encodeURIComponent(normalizedCode)}/barangays/`)
      .then((data) => data
        .map((item) => ({ code: String(item?.code || ''), name: String(item?.name || '').trim() }))
        .filter((item) => item.code && item.name)
        .sort(byName))
      .catch((error) => {
        barangayPromises.delete(normalizedCode);
        throw error;
      });
    barangayPromises.set(normalizedCode, promise);
  }
  return barangayPromises.get(normalizedCode)!;
};
