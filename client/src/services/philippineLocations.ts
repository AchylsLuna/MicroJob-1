const PSGC_BASE_URL = "https://psgc.gitlab.io/api";
const LOCATION_TIMEOUT_MS = 8000;

export interface ProvinceOption {
  code: string;
  name: string;
}

export interface CityOption {
  code: string;
  name: string;
  provinceCode?: string;
}

export interface BarangayOption {
  code: string;
  name: string;
}

const fetchLocationJson = async (path: string): Promise<any[]> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), LOCATION_TIMEOUT_MS);
  try {
    const response = await fetch(`${PSGC_BASE_URL}${path}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Location service returned ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Location service returned invalid data.");
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Location options took too long to load.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export async function getPhilippineLocationOptions(): Promise<{
  provinces: ProvinceOption[];
  cities: CityOption[];
}> {
  const [provinceData, cityData] = await Promise.all([
    fetchLocationJson("/provinces/"),
    fetchLocationJson("/cities-municipalities/"),
  ]);

  const provinces = provinceData
    .map((item) => ({ code: String(item?.code || ""), name: String(item?.name || "").trim() }))
    .filter((item) => item.code && item.name)
    .sort(byName);
  const cities = cityData
    .map((item) => ({
      code: String(item?.code || ""),
      name: String(item?.name || "").trim(),
      provinceCode: item?.provinceCode ? String(item.provinceCode) : undefined,
    }))
    .filter((item) => item.code && item.name)
    .sort(byName);

  return { provinces, cities };
}

export async function getPhilippineBarangays(cityCode: string): Promise<BarangayOption[]> {
  const data = await fetchLocationJson(`/cities-municipalities/${encodeURIComponent(cityCode)}/barangays/`);
  return data
    .map((item) => ({ code: String(item?.code || ""), name: String(item?.name || "").trim() }))
    .filter((item) => item.code && item.name)
    .sort(byName);
}
