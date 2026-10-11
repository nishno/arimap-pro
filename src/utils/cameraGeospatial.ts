/**
 * Utility functions for camera optical field of view (FOV) geometry,
 * blind zone calculations, and DORI surveillance standards.
 */

export interface CameraOpticalParameters {
    centerLat: number;
    centerLng: number;
    azimuthDeg: number;   // 0 deg = North, 90 deg = East, 180 deg = South, 270 deg = West
    fovAngleDeg: number;  // Horizontal FOV angle (e.g. 90-110 deg)
    rangeM: number;       // Optical detection range in meters
    mountHeightM: number; // Height of pole in meters (e.g. 4-10m)
    tiltAngleDeg: number; // Downward tilt angle in degrees (e.g. 4 deg)
}

/**
 * Calculates blind zone distance in meters directly beneath the camera pole:
 * d_blind = mountHeight / tan(tiltAngle + verticalFov / 2)
 */
export function computeBlindZoneDistanceM(
    mountHeightM: number,
    tiltAngleDeg: number = 4,
    fovAngleDeg: number = 90
): number {
    const tilt = Math.max(1, tiltAngleDeg || 4);
    // 16:9 aspect ratio vertical FOV approximation: tan(vFov/2) = (9/16) * tan(hFov/2)
    const vFov = 2 * Math.atan(Math.tan((fovAngleDeg * Math.PI) / 360) * (9 / 16)) * (180 / Math.PI);
    const lowerAngleRad = ((tilt + vFov / 2) * Math.PI) / 180;
    const blindDist = mountHeightM / Math.tan(lowerAngleRad);
    return Math.max(0.5, Number(blindDist.toFixed(1)));
}

/**
 * Generates an array of [lat, lng] coordinates forming a closed wedge polygon for Leaflet
 */
export function computeFovConePolygon(
    centerLat: number,
    centerLng: number,
    azimuthDeg: number,
    fovAngleDeg: number,
    rangeM: number,
    numArcPoints: number = 24
): [number, number][] {
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return [];

    const safeAzimuth = (azimuthDeg % 360 + 360) % 360;
    const safeFov = Math.max(10, Math.min(180, fovAngleDeg));
    const safeRange = Math.max(5, rangeM);

    const halfFov = safeFov / 2;
    const startAngle = safeAzimuth - halfFov;
    const endAngle = safeAzimuth + halfFov;
    const step = (endAngle - startAngle) / numArcPoints;

    const latRad = (centerLat * Math.PI) / 180;
    const mPerDegLat = 111111;
    const mPerDegLng = 111111 * Math.cos(latRad);

    const polygonPoints: [number, number][] = [[centerLat, centerLng]];

    for (let i = 0; i <= numArcPoints; i++) {
        const angleDeg = startAngle + i * step;
        // 0 deg = North (lat+), 90 deg = East (lng+)
        const angleRad = (angleDeg * Math.PI) / 180;
        const dNorth = safeRange * Math.cos(angleRad);
        const dEast = safeRange * Math.sin(angleRad);

        const ptLat = centerLat + dNorth / mPerDegLat;
        const ptLng = centerLng + dEast / mPerDegLng;
        polygonPoints.push([ptLat, ptLng]);
    }

    // Close the polygon back to the center pole
    polygonPoints.push([centerLat, centerLng]);
    return polygonPoints;
}

/**
 * Computes blind zone wedge polygon (near-field area excluded from sensor visibility)
 */
export function computeBlindZonePolygon(
    params: CameraOpticalParameters,
    numArcPoints: number = 16
): [number, number][] {
    const blindDistM = computeBlindZoneDistanceM(
        params.mountHeightM, 
        params.tiltAngleDeg, 
        params.fovAngleDeg
    );
    const effectiveBlindM = Math.min(params.rangeM * 0.45, blindDistM);

    return computeFovConePolygon(
        params.centerLat,
        params.centerLng,
        params.azimuthDeg,
        params.fovAngleDeg,
        effectiveBlindM,
        numArcPoints
    );
}

/**
 * Computes DORI high-resolution Identification band (EN 62676-4 standard: ~35% of detection range)
 */
export function computeDoriIdPolygon(
    params: CameraOpticalParameters,
    numArcPoints: number = 16
): [number, number][] {
    const idRangeM = Math.max(3, params.rangeM * 0.35);
    return computeFovConePolygon(
        params.centerLat,
        params.centerLng,
        params.azimuthDeg,
        params.fovAngleDeg,
        idRangeM,
        numArcPoints
    );
}
