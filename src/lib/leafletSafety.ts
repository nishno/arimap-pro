import L from 'leaflet';

/**
 * Global Leaflet Safety Guard & Coordinate Normalizer
 * Intercepts L.LatLng and L.latLng to prevent runtime crashes from Invalid LatLng (NaN, NaN).
 */

const DEFAULT_LAT = 42.14;
const DEFAULT_LNG = 42.0;

export const isValidCoordinatePair = (lat: any, lng: any): boolean => {
    const numLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
    const numLng = typeof lng === 'number' ? lng : parseFloat(String(lng));
    return Number.isFinite(numLat) && Number.isFinite(numLng) && Math.abs(numLat) <= 90 && Math.abs(numLng) <= 180;
};

export const toSafeLatLngTuple = (input: any): [number, number] | null => {
    if (!input) return null;
    let lat = NaN;
    let lng = NaN;

    if (Array.isArray(input)) {
        if (input.length >= 2 && typeof input[0] !== 'object' && !Array.isArray(input[0])) {
            lat = typeof input[0] === 'number' ? input[0] : parseFloat(String(input[0]));
            lng = typeof input[1] === 'number' ? input[1] : parseFloat(String(input[1]));
        }
    } else if (typeof input === 'object' && input !== null) {
        const latVal = input.lat !== undefined ? input.lat : input.latitude;
        const lngVal = input.lng !== undefined ? input.lng : (input.lon !== undefined ? input.lon : input.longitude);
        lat = typeof latVal === 'number' ? latVal : parseFloat(String(latVal));
        lng = typeof lngVal === 'number' ? lngVal : parseFloat(String(lngVal));
    }

    if (isValidCoordinatePair(lat, lng)) {
        return [lat, lng];
    }
    return null;
};

export const extractSafePoints = (geometry: any): [number, number][] => {
    if (!geometry) return [];
    let parsed = geometry;
    if (typeof geometry === 'string') {
        try {
            parsed = JSON.parse(geometry);
        } catch {
            return [];
        }
    }
    // Handle double-encoded JSON strings
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return [];
        }
    }

    const points: [number, number][] = [];
    const traverse = (item: any) => {
        if (!item) return;
        if (Array.isArray(item)) {
            // Check if this array is a point [lat, lng]
            if (item.length === 2 && !Array.isArray(item[0]) && typeof item[0] !== 'object') {
                const pt = toSafeLatLngTuple(item);
                if (pt) points.push(pt);
            } else {
                for (let i = 0; i < item.length; i++) {
                    traverse(item[i]);
                }
            }
        } else if (typeof item === 'object' && item !== null) {
            const pt = toSafeLatLngTuple(item);
            if (pt) points.push(pt);
        }
    };

    traverse(parsed);
    return points;
};

// Patch Leaflet globally so that ANY call to L.LatLng, L.latLng or L.latLngBounds with NaN is smoothly recovered
try {
    if (typeof window !== 'undefined' && L && L.LatLng) {
        const OriginalLatLng = L.LatLng;

        function SafeLatLng(this: any, a: any, b?: any, c?: any) {
            let lat = a;
            let lng = b;
            let alt = c;

            if (a && typeof a === 'object' && 'lat' in a) {
                lat = a.lat;
                lng = 'lng' in a ? a.lng : a.lon;
                alt = a.alt;
            } else if (Array.isArray(a)) {
                lat = a[0];
                lng = a[1];
                alt = a[2];
            }

            let numLat = typeof lat === 'number' ? lat : parseFloat(String(lat));
            let numLng = typeof lng === 'number' ? lng : parseFloat(String(lng));

            if (!Number.isFinite(numLat) || !Number.isFinite(numLng) || isNaN(numLat) || isNaN(numLng)) {
                numLat = DEFAULT_LAT;
                numLng = DEFAULT_LNG;
            }

            return new (OriginalLatLng as any)(numLat, numLng, alt);
        }

        SafeLatLng.prototype = OriginalLatLng.prototype;
        (L as any).LatLng = SafeLatLng;

        const origToLatLng = L.latLng;
        (L as any).latLng = function (...args: any[]) {
            try {
                const a = args[0];
                if (a instanceof OriginalLatLng) {
                    if (isNaN(a.lat) || isNaN(a.lng) || !Number.isFinite(a.lat) || !Number.isFinite(a.lng)) {
                        return new (OriginalLatLng as any)(DEFAULT_LAT, DEFAULT_LNG);
                    }
                    return a;
                }
                const res = origToLatLng.apply(this, args as any);
                if (res && Number.isFinite(res.lat) && Number.isFinite(res.lng) && !isNaN(res.lat) && !isNaN(res.lng)) {
                    return res;
                }
                return new (OriginalLatLng as any)(DEFAULT_LAT, DEFAULT_LNG);
            } catch {
                return new (OriginalLatLng as any)(DEFAULT_LAT, DEFAULT_LNG);
            }
        };

        const origLatLngBounds = L.latLngBounds;
        (L as any).latLngBounds = function (...args: any[]) {
            try {
                const res = origLatLngBounds.apply(this, args as any);
                if (res && typeof res.isValid === 'function' && res.isValid()) {
                    return res;
                }
                return origLatLngBounds.apply(this, [[[DEFAULT_LAT, DEFAULT_LNG], [DEFAULT_LAT, DEFAULT_LNG]]] as any);
            } catch {
                return origLatLngBounds.apply(this, [[[DEFAULT_LAT, DEFAULT_LNG], [DEFAULT_LAT, DEFAULT_LNG]]] as any);
            }
        };

        if (L.LatLngBounds && L.LatLngBounds.prototype) {
            const origGetCenter = L.LatLngBounds.prototype.getCenter;
            L.LatLngBounds.prototype.getCenter = function () {
                try {
                    const center = origGetCenter.call(this);
                    if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng) && !isNaN(center.lat) && !isNaN(center.lng)) {
                        return center;
                    }
                    return new (OriginalLatLng as any)(DEFAULT_LAT, DEFAULT_LNG);
                } catch {
                    return new (OriginalLatLng as any)(DEFAULT_LAT, DEFAULT_LNG);
                }
            };
        }

        // Global Canvas Renderer Safety Guard for Leaflet (L.Canvas)
        // Prevents "Uncaught TypeError: Cannot read properties of undefined (reading 'clearRect')"
        // when vector layers are unmounted, moved, or redrawn after container disposal.
        if ((L as any).Canvas && (L as any).Canvas.prototype) {
            const CanvasProto = (L as any).Canvas.prototype;

            const origClear = CanvasProto._clear;
            CanvasProto._clear = function () {
                if (!this._ctx || !this._container) return;
                try {
                    if (origClear) {
                        origClear.call(this);
                    }
                } catch (e) {
                    // Suppress unmounted/cleared canvas context clearRect errors
                }
            };

            const origDraw = CanvasProto._draw;
            CanvasProto._draw = function () {
                if (!this._ctx || !this._container) return;
                try {
                    if (origDraw) {
                        origDraw.call(this);
                    }
                } catch (e) {
                    // Suppress drawing on destroyed/detached context
                }
            };

            const origRedraw = CanvasProto._redraw;
            CanvasProto._redraw = function () {
                if (!this._ctx || !this._container) {
                    this._redrawRequest = null;
                    return;
                }
                try {
                    if (origRedraw) {
                        origRedraw.call(this);
                    }
                } catch (e) {
                    this._redrawRequest = null;
                }
            };

            const origUpdate = CanvasProto._update;
            CanvasProto._update = function () {
                if (!this._ctx || !this._container) return;
                try {
                    if (origUpdate) {
                        origUpdate.call(this);
                    }
                } catch (e) {
                    // Suppress canvas dimension update on disposed container
                }
            };

            const origDestroyContainer = CanvasProto._destroyContainer;
            CanvasProto._destroyContainer = function () {
                if (this._redrawRequest) {
                    try {
                        (L as any).Util?.cancelAnimFrame?.(this._redrawRequest);
                    } catch (_) {}
                    this._redrawRequest = null;
                }
                try {
                    if (origDestroyContainer) {
                        origDestroyContainer.call(this);
                    }
                } catch (e) {
                    // Gracefully handle container teardown
                }
            };
        }
    }
} catch (e) {
    console.warn('[Leaflet Safety Interceptor] Error initializing safety patches:', e);
}
