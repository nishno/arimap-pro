export type LocalUser = {
  id: string;
  name: string;
  username: string;
  role: "owner" | "worker";
  active?: number;
};
export type Farm = {
  id: string;
  name: string;
  timezone: string;
};
export type Field = {
  id: string;
  name: string;
  crop: string;
  area_ha: number;
};
export type Harvest = {
  id: string;
  field_id?: string;
  field_name: string;
  kg: number;
  recorded_at: string;
  recorded_by: string;
};
export type Session = {
  user: LocalUser;
  farm: Farm;
};
export class LocalError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export async function local<T>(route: string, input?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/local/${route}`, {
      credentials: "same-origin",
      cache: "no-store",
      ...(input
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          }
        : {}),
    });
  } catch {
    throw new LocalError(
      "Cannot reach the farm server. Check Wi-Fi and keep your entry open to retry.",
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new LocalError(
      "The local farm server is not available at this address.",
      503,
    );
  const data = await response.json();
  if (!response.ok)
    throw new LocalError(
      data.error || "The request could not be completed.",
      response.status,
    );
  return data;
}
export const sampleFields: Field[] = [
  { id: "north", name: "North orchard", crop: "Blueberries", area_ha: 4.2 },
  { id: "east", name: "East vineyard", crop: "Grapes", area_ha: 6.8 },
  { id: "south", name: "South field", crop: "Hazelnuts", area_ha: 5.4 },
];
export const sampleHarvests: Harvest[] = [
  {
    id: "s1",
    field_name: "North orchard",
    kg: 240,
    recorded_at: "2026-10-12T06:30:00Z",
    recorded_by: "Sample team",
  },
  {
    id: "s2",
    field_name: "East vineyard",
    kg: 180,
    recorded_at: "2026-10-12T07:30:00Z",
    recorded_by: "Sample team",
  },
];
