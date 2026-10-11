import React from 'react';
import type { PlantationFeature } from '../../../types';
import { NvrCameraMasterConsole } from './NvrCameraMasterConsole';

export interface PlantationCamera {
    id: string;
    name: string;
    channel: number;
    model: string;
    ipAddress: string;
    rtspPort: number;
    streamUrl?: string;
    locationName: string;
    lat: number;
    lng: number;
    mountHeightM: number;
    azimuthDeg: number;
    fovAngleDeg: number;
    rangeM: number;
    tiltAngleDeg: number; // e.g. 4 degrees down-tilt
    focalLengthMm?: number;
    opticalZoomLevel?: number;
    blindZoneRadiusM?: number;
    isPtz: boolean;
    isNightVision: boolean;
    status: 'ONLINE' | 'STANDBY' | 'RECORDING';
}

export interface DiscoveredNetworkDevice {
    id: string;
    alias: string;
    type: 'NVR' | 'DVR' | 'IP_CAMERA' | 'PTZ_CAMERA' | 'THERMAL_CAMERA' | 'DRONE' | 'GPS_ROVER' | 'SOIL_SENSOR' | 'WEATHER_STATION' | 'IOT_GATEWAY';
    brand: string;
    model: string;
    ip: string;
    httpPort: number;
    rtspPort: number;
    serverPort: number;
    mac: string;
    subnetMask: string;
    gateway: string;
    channelsCount?: number;
    channels?: {
        channel: number;
        name: string;
        model: string;
        ip: string;
        rtspUrl: string;
        resolution: string;
        status: 'ONLINE' | 'STANDBY' | 'NO_SIGNAL';
        isNightVision?: boolean;
        isPtz?: boolean;
    }[];
    firmwareVersion: string;
    activationStatus: 'ACTIVATED' | 'INACTIVE' | 'LOCKED';
    lastSeen: string;
    pingMs: number;
    isVerified?: boolean;
    telemetry?: any;
}

export interface CameraNvrLabProps {
    mapCenter?: [number, number];
    plantationFeatures?: PlantationFeature[];
    onDeployCameraToMap?: (cam: PlantationCamera) => void;
}

export const CameraNvrLab: React.FC<CameraNvrLabProps> = ({
    mapCenter = [41.9023, 44.5],
    plantationFeatures = [],
    onDeployCameraToMap
}) => {
    return (
        <div className="w-full h-full min-h-[750px] flex flex-col">
            <NvrCameraMasterConsole
                isModal={false}
                mapCenter={mapCenter}
                plantationFeatures={plantationFeatures}
                onDeployCameraToMap={onDeployCameraToMap}
            />
        </div>
    );
};
