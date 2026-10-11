/**
 * Fetches a route between two points using the OSRM API.
 * @param start [lat, lng]
 * @param end [lat, lng]
 */
export const getRoute = async (start: [number, number], end: [number, number]): Promise<[number, number][]> => {
    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.code !== 'Ok') {
            throw new Error('OSRM Route Error: ' + data.code);
        }
        
        // OSRM returns [lng, lat], we need [lat, lng]
        return data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
    } catch (error) {
        console.error("Failed to fetch route from OSRM:", error);
        return [];
    }
};
