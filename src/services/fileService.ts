/**
 * Converts features to a GeoJSON string.
 */
export const toGeoJSON = (features: any[]): string => {
    const geojson = {
        type: "FeatureCollection",
        features: features.map(f => ({
            type: "Feature",
            properties: {
                name: f.name,
                type: f.type,
                color: f.color,
                ...f.metadata
            },
            geometry: {
                type: f.type === 'area' ? 'Polygon' : (f.type === 'line' ? 'LineString' : 'Point'),
                coordinates: f.type === 'area' ? [f.geometry.map((p: any) => [p[1], p[0]])] : f.geometry.map((p: any) => [p[1], p[0]])
            }
        }))
    };
    return JSON.stringify(geojson, null, 2);
};

/**
 * Converts features to a KML string (simplified).
 */
export const toKML = (features: any[]): string => {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>AgriMap Export</name>`;
    
    features.forEach(f => {
        kml += `
    <Placemark>
      <name>${f.name}</name>
      <Style>
        <LineStyle><color>${f.color || 'ff0000ff'}</color></LineStyle>
        <PolyStyle><color>${f.color || 'ff0000ff'}</color></PolyStyle>
      </Style>`;
      
        if (f.type === 'area') {
            kml += `
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${f.geometry.map((p: any) => `${p[1]},${p[0]},0`).join(' ')}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>`;
        } else if (f.type === 'line') {
            kml += `
      <LineString>
        <coordinates>${f.geometry.map((p: any) => `${p[1]},${p[0]},0`).join(' ')}</coordinates>
      </LineString>`;
        } else {
            kml += `
      <Point>
        <coordinates>${f.geometry[1]},${f.geometry[0]},0</coordinates>
      </Point>`;
        }
        
        kml += `
    </Placemark>`;
    });
    
    kml += `
  </Document>
</kml>`;
    return kml;
};
