import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { 
    Maximize2, RotateCcw, Eye, Navigation, Camera as CameraIcon, 
    Layers, AlertTriangle, ShieldCheck, Sun, Compass, Play, 
    Pause, Sliders, Sparkles, X, ChevronRight, Droplets, User, Mountain,
    Plus, Crosshair, ArrowUpDown, Video, Undo2, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import type { PlantationFeature } from '../../../types';
import type { PlantationCamera } from './CameraNvrLab';
import type { 
    SandboxDroneMission, 
    SandboxSoilSensor, 
    SandboxWaterSensor, 
    SandboxWorkerGps 
} from './HardwareTestingSandboxMap';
import { 
    getElevationAtCoords, 
    getSlopeAndAspect, 
    computeTerrainViewshed, 
    checkDrone3DPathCollision,
    type HillSpineProfile,
    type SpineControlPoint,
    setActiveSpineProfilesCache
} from '../../../utils/demTerrainViewshed';

interface Sandbox3DTerrainCanvasProps {
    plantationFeatures?: PlantationFeature[];
    cameras?: PlantationCamera[];
    droneMission?: SandboxDroneMission;
    soilSensors?: SandboxSoilSensor[];
    waterSensors?: SandboxWaterSensor[];
    workersGps?: SandboxWorkerGps[];
    selectedCameraId?: string;
    activeCameraId?: string;
    onSelectCamera?: ((cam: PlantationCamera) => void) | ((camId: any) => void);
    onSelectDevice?: (type: 'camera' | 'soil' | 'water' | 'worker' | 'drone' | 'slope_point', data: any) => void;
    onAddSpinePoint?: (coords: { lat: number; lng: number; peakHeightM?: number; widthM?: number }) => void;
    onUpdateSpinePoint?: (pointId: string, patch: Partial<SpineControlPoint>) => void;
    mapCenter?: [number, number];
    baseLat?: number;
    baseLng?: number;
    isKa?: boolean;
    onSwitchTo2D?: () => void;
    onSwap2d3d?: () => void;
    isMainFullView?: boolean;
    terrainKey?: number | string;
    initialViewMode?: 'orbit' | 'drone_cockpit' | 'camera_fov';
    viewMode?: any;
    spineProfile?: HillSpineProfile;
    hillSpineProfile?: HillSpineProfile;
    elevationExaggeration?: number;
    hiddenCameraIds?: string[];
    isSatelliteDemLoaded?: boolean;
    terrainUpdateCounter?: number;
    onDeleteLastPoint?: () => void;
    onDeleteSlope?: () => void;
}

export const Sandbox3DTerrainCanvas: React.FC<Sandbox3DTerrainCanvasProps> = ({
    plantationFeatures = [],
    cameras = [],
    droneMission,
    soilSensors = [],
    waterSensors = [],
    workersGps = [],
    selectedCameraId,
    activeCameraId,
    onSelectCamera,
    onSelectDevice,
    onAddSpinePoint,
    onUpdateSpinePoint,
    mapCenter,
    baseLat: propBaseLat,
    baseLng: propBaseLng,
    isKa = false,
    onSwitchTo2D,
    onSwap2d3d,
    isMainFullView = false,
    terrainKey,
    initialViewMode = 'orbit',
    viewMode: propViewMode,
    spineProfile,
    hillSpineProfile,
    elevationExaggeration: propExaggeration,
    hiddenCameraIds = [],
    isSatelliteDemLoaded = false,
    terrainUpdateCounter,
    onDeleteLastPoint,
    onDeleteSlope
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const baseLat = propBaseLat ?? (mapCenter ? mapCenter[0] : 41.9023);
    const baseLng = propBaseLng ?? (mapCenter ? mapCenter[1] : 44.5);
    const effectiveSpineProfile = hillSpineProfile || spineProfile;
    const effectiveSelectedCameraId = activeCameraId || selectedCameraId;

    // View & Camera Controls
    const [viewMode, setViewMode] = useState<'orbit' | 'drone_cockpit' | 'camera_fov'>(initialViewMode);

    useEffect(() => {
        if (initialViewMode) {
            setViewMode(initialViewMode);
        }
    }, [initialViewMode]);
    const [elevationExaggeration, setElevationExaggeration] = useState<number>(propExaggeration || 1.8);

    useEffect(() => {
        if (propExaggeration !== undefined) {
            setElevationExaggeration(propExaggeration);
        }
    }, [propExaggeration]);
    const [showFrustums, setShowFrustums] = useState<boolean>(true);
    const [showTerrainShadows, setShowTerrainShadows] = useState<boolean>(true);
    const [showContourGrid, setShowContourGrid] = useState<boolean>(true);
    const [activeCameraIdx, setActiveCameraIdx] = useState<number>(0);

    // Collision Warnings
    const collisionCheck = useMemo(() => {
        if (!droneMission?.waypoints || droneMission.waypoints.length === 0) {
            return { hasCollisionWarning: false, minimumClearanceM: 999 };
        }
        return checkDrone3DPathCollision(
            droneMission.waypoints,
            baseLat,
            baseLng,
            6 // 6m minimum safe clearance AGL
        );
    }, [droneMission?.waypoints, baseLat, baseLng]);

    // Three.js References
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const terrainMeshRef = useRef<THREE.Mesh | null>(null);
    const droneMeshRef = useRef<THREE.Group | null>(null);
    const rotorsRef = useRef<THREE.Mesh[]>([]);
    const reqAnimRef = useRef<number | null>(null);
    const interactiveObjectsRef = useRef<THREE.Object3D[]>([]);

    // 3D Point Addition & Slope Height Drag State
    const [isAddingSlopePoint3D, setIsAddingSlopePoint3D] = useState<boolean>(false);
    const draggedPointIdRef = useRef<string | null>(null);
    const initialDragPosRef = useRef<{ clientY: number; initialHeight: number } | null>(null);

    // Orbit State
    const isDraggingRef = useRef<boolean>(false);
    const dragDistanceRef = useRef<number>(0);
    const prevMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const sphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
        radius: 320,
        theta: Math.PI / 4,
        phi: Math.PI / 3.2
    });
    const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

    // Meter per coordinate scaling
    const latRad = (baseLat * Math.PI) / 180;
    const mPerDegLat = 111111;
    const mPerDegLng = 111111 * Math.cos(latRad);

    const toLocalX = (lng: number) => (lng - baseLng) * mPerDegLng;
    const toLocalZ = (lat: number) => -(lat - baseLat) * mPerDegLat; // In Three.js: -Z is North, +X is East, +Y is Elevation

    // Helper to generate floating high-visibility 3D billboard text sprites
    const createBillboardText = (text: string, bgColor: string, textColor: string, borderColor: string): THREE.Sprite => {
        const canvas = document.createElement('canvas');
        canvas.width = 384;
        canvas.height = 80;
        const ctx = canvas.getContext('2d')!;
        
        ctx.fillStyle = bgColor;
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(4, 4, 376, 72, 16);
            ctx.fill();
        } else {
            ctx.fillRect(4, 4, 376, 72);
        }
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 5;
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = 'bold 26px "JetBrains Mono", monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 192, 40);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(30, 6.5, 1);
        return sprite;
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const width = container.clientWidth || 800;
        const height = container.clientHeight || 540;

        // 1. Scene Setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        scene.background = new THREE.Color(0x060d17);
        scene.fog = new THREE.FogExp2(0x060d17, 0.0018);

        // 2. Camera Setup
        const camera = new THREE.PerspectiveCamera(48, width / height, 1, 2500);
        cameraRef.current = camera;

        // 3. Renderer Setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        rendererRef.current = renderer;
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // 4. Lighting Setup (Simulate sun and ambient orchard atmosphere)
        const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.65);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.4);
        sunLight.position.set(160, 280, 140);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 800;
        const d = 260;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        scene.add(sunLight);

        const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.4);
        scene.add(hemiLight);

        // 5. Generate 3D Terrain Elevation Mesh from DEM
        interactiveObjectsRef.current = [];
        if (effectiveSpineProfile) {
            setActiveSpineProfilesCache([effectiveSpineProfile]);
        }

        const gridSize = 64;
        const terrainSpanM = 480; // 480m x 480m field
        const geometry = new THREE.PlaneGeometry(terrainSpanM, terrainSpanM, gridSize, gridSize);
        geometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

        const posAttr = geometry.attributes.position;
        const colors = new Float32Array(posAttr.count * 3);

        const baseEle = 480;

        for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getZ(i);

            const ptLng = baseLng + x / mPerDegLng;
            const ptLat = baseLat - z / mPerDegLat;

            const eleM = getElevationAtCoords(ptLat, ptLng, baseLat, baseLng, baseEle);
            const relY = (eleM - baseEle) * elevationExaggeration;
            posAttr.setY(i, relY);

            // Slope-aware terrain shading: green terrace -> golden rise -> rock crest
            const { slopeDeg } = getSlopeAndAspect(ptLat, ptLng, baseLat, baseLng);
            const normElevation = Math.max(0, Math.min(1, (eleM - baseEle) / 25));

            if (slopeDeg > 22) {
                // Steep slope / ravine: rocky earth color
                colors[i * 3 + 0] = 0.45;
                colors[i * 3 + 1] = 0.38;
                colors[i * 3 + 2] = 0.30;
            } else if (normElevation > 0.6) {
                // High ridge: sunlit pasture
                colors[i * 3 + 0] = 0.22;
                colors[i * 3 + 1] = 0.55;
                colors[i * 3 + 2] = 0.24;
            } else {
                // Orchard terrace: lush agricultural green
                colors[i * 3 + 0] = 0.12;
                colors[i * 3 + 1] = 0.42;
                colors[i * 3 + 2] = 0.20;
            }
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const terrainMat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.1,
            wireframe: false
        });

        const terrainMesh = new THREE.Mesh(geometry, terrainMat);
        terrainMesh.receiveShadow = true;
        terrainMeshRef.current = terrainMesh;
        scene.add(terrainMesh);

        // Optional wireframe contour overlay
        if (showContourGrid) {
            const wireframeMat = new THREE.MeshBasicMaterial({
                color: 0x34d399,
                wireframe: true,
                transparent: true,
                opacity: 0.08
            });
            const wireframeMesh = new THREE.Mesh(geometry, wireframeMat);
            wireframeMesh.position.y += 0.2;
            scene.add(wireframeMesh);
        }

        // 6. Draw Sectors & Trenches draped onto 3D Terrain
        const trenchLines = [
            { id: 1, x: -70 }, { id: 2, x: -35 }, { id: 3, x: 0 }, { id: 4, x: 35 }, { id: 5, x: 70 }
        ];

        trenchLines.forEach(tr => {
            const points: THREE.Vector3[] = [];
            for (let z = -140; z <= 140; z += 10) {
                const ptLat = baseLat - z / mPerDegLat;
                const ptLng = baseLng + tr.x / mPerDegLng;
                const eleY = (getElevationAtCoords(ptLat, ptLng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration + 0.6;
                points.push(new THREE.Vector3(tr.x, eleY, z));
            }
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineDashedMaterial({
                color: tr.id === 3 ? 0x06b6d4 : 0xf59e0b,
                linewidth: 2,
                dashSize: 4,
                gapSize: 2
            });
            const line = new THREE.Line(lineGeo, lineMat);
            line.computeLineDistances();
            scene.add(line);
        });

        // 6.5 Render Mound Ridge Spine line, Width Cross-Sections, and Connection Points (A, B, C...) in 3D
        if (effectiveSpineProfile && effectiveSpineProfile.points && effectiveSpineProfile.points.length >= 2) {
            const spinePoints3D: THREE.Vector3[] = [];
            const leftHullPoints: THREE.Vector3[] = [];
            const rightHullPoints: THREE.Vector3[] = [];

            effectiveSpineProfile.points.forEach((pt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const ptX = toLocalX(pt.lng);
                const ptZ = toLocalZ(pt.lat);
                const ptEle = (getElevationAtCoords(pt.lat, pt.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration + 1.2;
                const pointVec = new THREE.Vector3(ptX, ptEle, ptZ);
                spinePoints3D.push(pointVec);

                // 3D Connection Point Marker Sphere
                const markerGeo = new THREE.SphereGeometry(3.5, 16, 16);
                const markerMat = new THREE.MeshStandardMaterial({
                    color: 0xf59e0b,
                    emissive: 0xd97706,
                    metalness: 0.8,
                    roughness: 0.2
                });
                const markerMesh = new THREE.Mesh(markerGeo, markerMat);
                markerMesh.position.copy(pointVec);
                markerMesh.userData = { type: 'slope_point', data: pt };
                scene.add(markerMesh);
                interactiveObjectsRef.current.push(markerMesh);

                // Floating 3D Billboard Label for Slope Point
                const widthM = pt.widthM || 40;
                const ptLabel = createBillboardText(
                    `🏔️ Point ${letter}: +${pt.peakHeightM}m (W:${widthM}m)`,
                    '#0f172a',
                    '#fbbf24',
                    '#f59e0b'
                );
                ptLabel.position.set(ptX, ptEle + 8, ptZ);
                scene.add(ptLabel);

                // Vertical Elevation Guide Line (Base to Peak)
                const baseGroundEle = (getElevationAtCoords(pt.lat, pt.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;
                const vertGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(ptX, baseGroundEle, ptZ),
                    pointVec
                ]);
                const vertLine = new THREE.Line(vertGeo, new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.7 }));
                scene.add(vertLine);

                // 3D Cross-Section Width Line at this Point (Showing Width W in 3D)
                let dirX = 1;
                let dirZ = 0;
                if (idx < effectiveSpineProfile.points.length - 1) {
                    const nextPt = effectiveSpineProfile.points[idx + 1];
                    const dLng = toLocalX(nextPt.lng) - ptX;
                    const dLat = toLocalZ(nextPt.lat) - ptZ;
                    const len = Math.hypot(dLng, dLat) || 1;
                    dirX = -dLat / len;
                    dirZ = dLng / len;
                } else if (idx > 0) {
                    const prevPt = effectiveSpineProfile.points[idx - 1];
                    const dLng = ptX - toLocalX(prevPt.lng);
                    const dLat = ptZ - toLocalZ(prevPt.lat);
                    const len = Math.hypot(dLng, dLat) || 1;
                    dirX = -dLat / len;
                    dirZ = dLng / len;
                }

                const halfW = widthM / 2;
                const leftVec = new THREE.Vector3(ptX + dirX * halfW, ptEle, ptZ + dirZ * halfW);
                const rightVec = new THREE.Vector3(ptX - dirX * halfW, ptEle, ptZ - dirZ * halfW);
                leftHullPoints.push(leftVec);
                rightHullPoints.push(rightVec);

                const widthBarGeo = new THREE.BufferGeometry().setFromPoints([leftVec, rightVec]);
                const widthBarMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
                const widthBar = new THREE.Line(widthBarGeo, widthBarMat);
                scene.add(widthBar);

                // End caps on the width line
                [leftVec, rightVec].forEach(capPos => {
                    const capGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.8, 8);
                    const capMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
                    const cap = new THREE.Mesh(capGeo, capMat);
                    cap.position.copy(capPos);
                    scene.add(cap);
                });
            });

            // Glowing Ridge Line Tube along points A, B, C, D...
            try {
                const spineCurve = new THREE.CatmullRomCurve3(spinePoints3D);
                const spineTubeGeo = new THREE.TubeGeometry(spineCurve, 32, 1.4, 8, false);
                const spineTubeMat = new THREE.MeshStandardMaterial({
                    color: 0xf59e0b,
                    emissive: 0xb45309,
                    roughness: 0.3
                });
                const spineTube = new THREE.Mesh(spineTubeGeo, spineTubeMat);
                scene.add(spineTube);
            } catch (e) {
                const ridgeGeo = new THREE.BufferGeometry().setFromPoints(spinePoints3D);
                const ridgeMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 3.5 });
                scene.add(new THREE.Line(ridgeGeo, ridgeMat));
            }

            // 3D Perimeter Polygon Hull (Purple Outline in 3D matching 2D Sketch!)
            if (leftHullPoints.length > 1 && rightHullPoints.length > 1) {
                const hullPoints3D = [...leftHullPoints, ...rightHullPoints.slice().reverse(), leftHullPoints[0]];
                const hullGeo = new THREE.BufferGeometry().setFromPoints(hullPoints3D);
                const hullMat = new THREE.LineBasicMaterial({ color: 0xd946ef, linewidth: 3.5 });
                scene.add(new THREE.Line(hullGeo, hullMat));
            }
        }

        // 7. Cameras with 3D Frustum Cones & Terrain Slope Shadows
        cameras.forEach((cam, idx) => {
            if (hiddenCameraIds.includes(cam.id)) return;
            if (!cam || !cam.lat || !cam.lng || isNaN(cam.lat) || isNaN(cam.lng)) return;
            const isSelected = effectiveSelectedCameraId === cam.id;
            const localX = toLocalX(cam.lng);
            const localZ = toLocalZ(cam.lat);
            const groundZ = (getElevationAtCoords(cam.lat, cam.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;
            const poleHeight = Math.max(16, (cam.mountHeightM || 8) * 1.8 * elevationExaggeration);

            // Tall Glowing Sky Beacon Light Beam (makes cameras immediately visible across 3D terrain!)
            const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 55, 8);
            const beamMat = new THREE.MeshBasicMaterial({
                color: isSelected ? 0x10b981 : 0x06b6d4,
                transparent: true,
                opacity: 0.65
            });
            const beam = new THREE.Mesh(beamGeo, beamMat);
            beam.position.set(localX, groundZ + poleHeight + 28, localZ);
            scene.add(beam);

            // Highly visible Camera Mast / Tower
            const poleGeo = new THREE.CylinderGeometry(isSelected ? 1.5 : 1.1, isSelected ? 1.9 : 1.4, poleHeight, 12);
            const poleMat = new THREE.MeshStandardMaterial({ 
                color: isSelected ? 0x10b981 : 0x0284c7, 
                metalness: 0.7, 
                roughness: 0.3,
                emissive: isSelected ? 0x059669 : 0x0369a1
            });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(localX, groundZ + poleHeight / 2, localZ);
            pole.castShadow = true;
            pole.userData = { type: 'camera', data: cam };
            scene.add(pole);
            interactiveObjectsRef.current.push(pole);

            // Top Glowing Pulsing Beacon Orb
            const beaconGeo = new THREE.SphereGeometry(3.5, 16, 16);
            const beaconMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: isSelected ? 0x10b981 : 0x06b6d4,
                roughness: 0.1,
                metalness: 0.9
            });
            const beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(localX, groundZ + poleHeight + 2.5, localZ);
            scene.add(beacon);

            // Ground Target Ring
            const ringGeo = new THREE.RingGeometry(8, 11, 24);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
            const groundRing = new THREE.Mesh(ringGeo, ringMat);
            groundRing.position.set(localX, groundZ + 0.4, localZ);
            scene.add(groundRing);

            // Camera Housing & Lens
            const headGeo = new THREE.BoxGeometry(isSelected ? 3.5 : 2.8, isSelected ? 2.5 : 2.0, isSelected ? 4.5 : 3.6);
            const headMat = new THREE.MeshStandardMaterial({ 
                color: isSelected ? 0x10b981 : 0x2563eb, 
                metalness: 0.8, 
                roughness: 0.2,
                emissive: isSelected ? 0x047857 : 0x1e3a8a
            });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.set(localX, groundZ + poleHeight, localZ);
            head.rotation.y = -(cam.azimuthDeg * Math.PI) / 180;
            head.userData = { type: 'camera', data: cam };
            scene.add(head);
            interactiveObjectsRef.current.push(head);

            // Floating 3D Billboard Label for Camera
            const camLabel = createBillboardText(
                `📹 [CH0${cam.channel}] ${cam.name}`,
                '#020617',
                '#38bdf8',
                '#0284c7'
            );
            camLabel.position.set(localX, groundZ + poleHeight + 8, localZ);
            scene.add(camLabel);

            // 3D FRUSTUM PYRAMID (Raycast Viewshed Visualization)
            if (showFrustums) {
                const viewshed = computeTerrainViewshed(
                    {
                        id: cam.id,
                        name: cam.name,
                        lat: cam.lat,
                        lng: cam.lng,
                        mountHeightM: cam.mountHeightM || 6,
                        azimuthDeg: cam.azimuthDeg || 0,
                        tiltAngleDeg: cam.tiltAngleDeg || 4,
                        fovAngleDeg: cam.fovAngleDeg || 95,
                        rangeM: cam.rangeM || 75
                    },
                    baseLat,
                    baseLng,
                    24
                );

                const apex = new THREE.Vector3(localX, groundZ + poleHeight, localZ);
                const corners = viewshed.frustum3DVertices.slice(1).map(c => {
                    return new THREE.Vector3(c[0], (c[2] - baseEle) * elevationExaggeration, -c[1]);
                });

                if (corners.length >= 4) {
                    const frustumGeo = new THREE.BufferGeometry();
                    const vertices = [
                        // 4 Triangular Side Faces
                        apex.x, apex.y, apex.z, corners[0].x, corners[0].y, corners[0].z, corners[1].x, corners[1].y, corners[1].z,
                        apex.x, apex.y, apex.z, corners[1].x, corners[1].y, corners[1].z, corners[2].x, corners[2].y, corners[2].z,
                        apex.x, apex.y, apex.z, corners[2].x, corners[2].y, corners[2].z, corners[3].x, corners[3].y, corners[3].z,
                        apex.x, apex.y, apex.z, corners[3].x, corners[3].y, corners[3].z, corners[0].x, corners[0].y, corners[0].z,
                        // Far Rectangular Base
                        corners[0].x, corners[0].y, corners[0].z, corners[2].x, corners[2].y, corners[2].z, corners[1].x, corners[1].y, corners[1].z,
                        corners[0].x, corners[0].y, corners[0].z, corners[3].x, corners[3].y, corners[3].z, corners[2].x, corners[2].y, corners[2].z
                    ];
                    frustumGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    frustumGeo.computeVertexNormals();

                    const frustumMat = new THREE.MeshBasicMaterial({
                        color: idx === 0 ? 0x3b82f6 : 0x10b981,
                        transparent: true,
                        opacity: 0.16,
                        side: THREE.DoubleSide
                    });

                    const frustumMesh = new THREE.Mesh(frustumGeo, frustumMat);
                    scene.add(frustumMesh);

                    // Wireframe outline of the 3D Frustum
                    const edgesGeo = new THREE.EdgesGeometry(frustumGeo);
                    const edgesMat = new THREE.LineBasicMaterial({
                        color: idx === 0 ? 0x60a5fa : 0x34d399,
                        transparent: true,
                        opacity: 0.4
                    });
                    const wireFrustum = new THREE.LineSegments(edgesGeo, edgesMat);
                    scene.add(wireFrustum);
                }

                // If slope shadow was detected, drape a red Blind Zone patch on the ground
                if (showTerrainShadows && viewshed.slopeShadowDetected && viewshed.blindZoneGroundPolygons.length > 0) {
                    const shadowPoints: THREE.Vector3[] = [];
                    viewshed.blindZoneGroundPolygons.forEach(arc => {
                        const pt1 = arc[0];
                        const pt2 = arc[1];
                        const pX = toLocalX((pt1[1] + pt2[1]) / 2);
                        const pZ = toLocalZ((pt1[0] + pt2[0]) / 2);
                        const pY = (getElevationAtCoords((pt1[0] + pt2[0]) / 2, (pt1[1] + pt2[1]) / 2, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration + 0.8;
                        shadowPoints.push(new THREE.Vector3(pX, pY, pZ));
                    });

                    const shadowGeo = new THREE.BufferGeometry().setFromPoints(shadowPoints);
                    const shadowMat = new THREE.PointsMaterial({
                        color: 0xef4444,
                        size: 3.5,
                        transparent: true,
                        opacity: 0.85
                    });
                    const shadowPointsMesh = new THREE.Points(shadowGeo, shadowMat);
                    scene.add(shadowPointsMesh);
                }
            }
        });

        // 7.1 Soil Sensors in 3D Space
        soilSensors.forEach((soil) => {
            const sX = toLocalX(soil.lng);
            const sZ = toLocalZ(soil.lat);
            const sGround = (getElevationAtCoords(soil.lat, soil.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;

            const group = new THREE.Group();
            group.position.set(sX, sGround, sZ);
            group.userData = { type: 'soil', data: soil };

            // Ground spike
            const spikeGeo = new THREE.CylinderGeometry(0.35, 0.1, 3.5, 8);
            const spikeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.y = 1.2;
            group.add(spike);

            // Soil sensor head probe
            const headGeo = new THREE.CylinderGeometry(1.2, 1.2, 1.8, 12);
            const headMat = new THREE.MeshStandardMaterial({
                color: 0x10b981,
                emissive: 0x059669,
                metalness: 0.5,
                roughness: 0.2
            });
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.y = 2.8;
            head.userData = { type: 'soil', data: soil };
            group.add(head);

            // Ground locator ring
            const ringGeo = new THREE.RingGeometry(2.4, 3.0, 16);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = 0.2;
            group.add(ring);

            scene.add(group);
            interactiveObjectsRef.current.push(head);
        });

        // 7.2 Water Sensors in 3D Space
        waterSensors.forEach((w) => {
            const wX = toLocalX(w.lng);
            const wZ = toLocalZ(w.lat);
            const wGround = (getElevationAtCoords(w.lat, w.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;

            const group = new THREE.Group();
            group.position.set(wX, wGround, wZ);
            group.userData = { type: 'water', data: w };

            // Water station housing
            const cabGeo = new THREE.BoxGeometry(2.4, 3.2, 2.4);
            const cabMat = new THREE.MeshStandardMaterial({
                color: 0x0284c7,
                emissive: 0x0369a1,
                metalness: 0.7,
                roughness: 0.3
            });
            const cab = new THREE.Mesh(cabGeo, cabMat);
            cab.position.y = 1.6;
            cab.userData = { type: 'water', data: w };
            group.add(cab);

            // Flow pipe
            const pipeGeo = new THREE.CylinderGeometry(0.5, 0.5, 4.2, 8);
            pipeGeo.rotateZ(Math.PI / 2);
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.8 });
            const pipe = new THREE.Mesh(pipeGeo, pipeMat);
            pipe.position.set(0, 1.2, 0);
            group.add(pipe);

            // Ground ring
            const ringGeo = new THREE.RingGeometry(2.6, 3.4, 16);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = 0.2;
            group.add(ring);

            scene.add(group);
            interactiveObjectsRef.current.push(cab);
        });

        // 7.3 Workers GPS in 3D Space
        workersGps.forEach((wrk) => {
            const wrkX = toLocalX(wrk.lng);
            const wrkZ = toLocalZ(wrk.lat);
            const wrkGround = (getElevationAtCoords(wrk.lat, wrk.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;

            const group = new THREE.Group();
            group.position.set(wrkX, wrkGround, wrkZ);
            group.userData = { type: 'worker', data: wrk };

            // High-vis vest body
            const bodyGeo = new THREE.CylinderGeometry(0.9, 0.7, 2.5, 8);
            const bodyMat = new THREE.MeshStandardMaterial({
                color: 0xf97316,
                emissive: 0xc2410c,
                metalness: 0.2,
                roughness: 0.6
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 1.5;
            body.userData = { type: 'worker', data: wrk };
            group.add(body);

            // Yellow hardhat
            const hatGeo = new THREE.SphereGeometry(0.75, 8, 8);
            const hatMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xa16207 });
            const hat = new THREE.Mesh(hatGeo, hatMat);
            hat.position.y = 3.2;
            group.add(hat);

            // Ground locator ring
            const ringGeo = new THREE.RingGeometry(2.2, 2.8, 16);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = 0.2;
            group.add(ring);

            scene.add(group);
            interactiveObjectsRef.current.push(body);
        });

        // 8. 3D Drone Quadcopter Model & 3D Flight Path
        const droneGroup = new THREE.Group();
        droneMeshRef.current = droneGroup;

        // Central Carbon Frame
        const frameGeo = new THREE.CylinderGeometry(2, 2.4, 0.8, 8);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
        const frameMesh = new THREE.Mesh(frameGeo, frameMat);
        frameMesh.userData = { type: 'drone', data: droneMission };
        droneGroup.add(frameMesh);
        interactiveObjectsRef.current.push(frameMesh);

        // 4 Rotor Arms
        const armGeo = new THREE.BoxGeometry(0.4, 0.3, 7);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
        const arm1 = new THREE.Mesh(armGeo, armMat);
        arm1.rotation.y = Math.PI / 4;
        const arm2 = new THREE.Mesh(armGeo, armMat);
        arm2.rotation.y = -Math.PI / 4;
        droneGroup.add(arm1, arm2);

        // 4 Spinning Rotors
        const rotors: THREE.Mesh[] = [];
        const rotorGeo = new THREE.BoxGeometry(3.6, 0.05, 0.4);
        const rotorMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.7 });

        [[-2.5, 2.5], [2.5, 2.5], [2.5, -2.5], [-2.5, -2.5]].forEach(([rx, rz]) => {
            const rotor = new THREE.Mesh(rotorGeo, rotorMat);
            rotor.position.set(rx, 0.6, rz);
            droneGroup.add(rotor);
            rotors.push(rotor);
        });
        rotorsRef.current = rotors;

        // Drone Gimbal 4K Camera Lens
        const gimbalGeo = new THREE.SphereGeometry(0.8, 8, 8);
        const gimbalMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2 });
        const gimbal = new THREE.Mesh(gimbalGeo, gimbalMat);
        gimbal.position.set(0, -0.6, 1.2);
        droneGroup.add(gimbal);

        scene.add(droneGroup);

        // 3D Flight Route Line (Suspended in air at altitude AGL)
        if (droneMission && droneMission.waypoints && droneMission.waypoints.length > 1) {
            const flightPoints = droneMission.waypoints.map(w => {
                const wX = toLocalX(w.lng);
                const wZ = toLocalZ(w.lat);
                const groundEle = (getElevationAtCoords(w.lat, w.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;
                const droneAlt = (w.altM || 35) * elevationExaggeration;
                return new THREE.Vector3(wX, groundEle + droneAlt, wZ);
            });

            const pathGeo = new THREE.BufferGeometry().setFromPoints(flightPoints);
            const pathMat = new THREE.LineBasicMaterial({
                color: 0x06b6d4,
                linewidth: 3,
                transparent: true,
                opacity: 0.8
            });
            const pathLine = new THREE.Line(pathGeo, pathMat);
            scene.add(pathLine);
        }

        // 9. Position Drone on Initial Coordinate
        const currentDroneLat = droneMission?.currentLat || baseLat;
        const currentDroneLng = droneMission?.currentLng || baseLng;
        const initialDroneX = toLocalX(currentDroneLng);
        const initialDroneZ = toLocalZ(currentDroneLat);
        const groundUnderDrone = (getElevationAtCoords(currentDroneLat, currentDroneLng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;
        droneGroup.position.set(initialDroneX, groundUnderDrone + (droneMission?.currentAlt || 35) * elevationExaggeration, initialDroneZ);

        // 10. Animation & Render Loop
        const animate = () => {
            reqAnimRef.current = requestAnimationFrame(animate);

            // Spin Drone Rotors
            rotorsRef.current.forEach((r, idx) => {
                r.rotation.y += (idx % 2 === 0 ? 0.35 : -0.35);
            });

            // Update Drone Position & Gimbal in 3D Space
            if (droneMeshRef.current && droneMission) {
                const dX = toLocalX(droneMission.currentLng || currentDroneLng);
                const dZ = toLocalZ(droneMission.currentLat || currentDroneLat);
                const dGround = (getElevationAtCoords(droneMission.currentLat || currentDroneLat, droneMission.currentLng || currentDroneLng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;
                const dY = dGround + (droneMission.currentAlt || 35) * elevationExaggeration;

                droneMeshRef.current.position.set(dX, dY, dZ);
                droneMeshRef.current.rotation.y = -((droneMission.directionDeg || 0) * Math.PI) / 180;
            }

            // Camera View Modes: Orbit vs Drone Cockpit View vs Camera Lens View
            if (viewMode === 'drone_cockpit' && droneMeshRef.current) {
                const dPos = droneMeshRef.current.position;
                const fwdX = Math.sin(-droneMeshRef.current.rotation.y);
                const fwdZ = Math.cos(-droneMeshRef.current.rotation.y);

                camera.position.set(dPos.x - fwdX * 12, dPos.y + 6, dPos.z - fwdZ * 12);
                camera.lookAt(dPos.x + fwdX * 30, dPos.y - 10, dPos.z + fwdZ * 30);
            } else if (viewMode === 'camera_fov' && cameras[activeCameraIdx]) {
                const cam = cameras[activeCameraIdx];
                const cX = toLocalX(cam.lng);
                const cZ = toLocalZ(cam.lat);
                const cGround = (getElevationAtCoords(cam.lat, cam.lng, baseLat, baseLng, baseEle) - baseEle) * elevationExaggeration;
                const cY = cGround + (cam.mountHeightM || 6) * elevationExaggeration;

                camera.position.set(cX, cY, cZ);
                const azRad = ((cam.azimuthDeg || 0) * Math.PI) / 180;
                const tiltRad = ((cam.tiltAngleDeg || 4) * Math.PI) / 180;
                camera.lookAt(
                    cX + Math.sin(azRad) * 100,
                    cY - Math.sin(tiltRad) * 100,
                    cZ - Math.cos(azRad) * 100
                );
            } else {
                // Orbit View
                const { radius, theta, phi } = sphericalRef.current;
                const target = targetLookAtRef.current;

                camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
                camera.position.y = target.y + radius * Math.cos(phi);
                camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
                camera.lookAt(target);
            }

            renderer.render(scene, camera);
        };

        animate();

        // 11. Resize Handler
        const handleResize = () => {
            if (!containerRef.current || !renderer || !camera) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
            renderer.dispose();
            geometry.dispose();
            terrainMat.dispose();
        };
    }, [
        baseLat, baseLng, elevationExaggeration, showFrustums, 
        showTerrainShadows, showContourGrid, viewMode, activeCameraIdx, cameras, terrainKey,
        selectedCameraId, activeCameraId, effectiveSpineProfile, soilSensors, waterSensors,
        workersGps, droneMission, hiddenCameraIds, terrainUpdateCounter, isSatelliteDemLoaded
    ]);

    // Focus 3D View on Surveillance Cameras
    const handleFocusCameras = () => {
        if (!cameras || cameras.length === 0) {
            toast.info(isKa ? 'კამერები არ არის დამატებული' : 'No cameras placed on map');
            return;
        }
        const validCams = cameras.filter(c => c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng));
        if (validCams.length === 0) return;
        const avgX = validCams.reduce((s, c) => s + toLocalX(c.lng), 0) / validCams.length;
        const avgZ = validCams.reduce((s, c) => s + toLocalZ(c.lat), 0) / validCams.length;
        targetLookAtRef.current.set(avgX, 15, avgZ);
        sphericalRef.current = {
            radius: 130,
            theta: Math.PI / 4,
            phi: Math.PI / 3.4
        };
        setViewMode('orbit');
        toast.info(isKa ? 'კამერები ცენტრშია' : 'Framed surveillance cameras in 3D');
    };

    // Mouse Drag Orbit Controls & 3D Click Raycaster
    const handleMouseDown = (e: React.MouseEvent) => {
        dragDistanceRef.current = 0;

        // Check if user clicked on a slope point or height handle to drag height vertically
        if (rendererRef.current && cameraRef.current) {
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
            const hits = raycaster.intersectObjects(interactiveObjectsRef.current, true);
            if (hits.length > 0) {
                let obj: THREE.Object3D | null = hits[0].object;
                while (obj && !obj.userData?.type && obj.parent) {
                    obj = obj.parent;
                }
                if (obj && obj.userData?.type === 'slope_point') {
                    draggedPointIdRef.current = obj.userData.data.id;
                    initialDragPosRef.current = { clientY: e.clientY, initialHeight: obj.userData.data.peakHeightM || 25 };
                    isDraggingRef.current = true;
                    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
                    return;
                }
            }
        }

        if (viewMode !== 'orbit') return;
        isDraggingRef.current = true;
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - prevMousePosRef.current.x;
        const dy = e.clientY - prevMousePosRef.current.y;
        dragDistanceRef.current += Math.abs(dx) + Math.abs(dy);
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };

        // If dragging slope point height vertically via mouse
        if (draggedPointIdRef.current && initialDragPosRef.current) {
            const vertDy = initialDragPosRef.current.clientY - e.clientY;
            const newHeight = Math.max(2, Math.min(90, Math.round(initialDragPosRef.current.initialHeight + vertDy * 0.4)));
            if (onUpdateSpinePoint) {
                onUpdateSpinePoint(draggedPointIdRef.current, { peakHeightM: newHeight });
            }
            return;
        }

        if (viewMode === 'orbit') {
            sphericalRef.current.theta -= dx * 0.007;
            sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2.05, sphericalRef.current.phi - dy * 0.007));
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        isDraggingRef.current = false;

        if (draggedPointIdRef.current) {
            draggedPointIdRef.current = null;
            initialDragPosRef.current = null;
            toast.success(isKa ? 'სიმაღლე განახლდა' : 'Slope height updated');
            return;
        }

        // If in "Add Slope Point in 3D" mode, raycast against the terrain mesh!
        if (isAddingSlopePoint3D && dragDistanceRef.current < 6 && rendererRef.current && cameraRef.current && terrainMeshRef.current) {
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
            const hits = raycaster.intersectObject(terrainMeshRef.current, false);
            if (hits.length > 0) {
                const hit = hits[0].point;
                const ptLng = baseLng + hit.x / mPerDegLng;
                const ptLat = baseLat - hit.z / mPerDegLat;
                if (onAddSpinePoint) {
                    onAddSpinePoint({ lat: ptLat, lng: ptLng, peakHeightM: 25, widthM: 45 });
                }
                setIsAddingSlopePoint3D(false);
                toast.success(isKa ? `3D წერტილი დაემატა: [${ptLat.toFixed(5)}, ${ptLng.toFixed(5)}]` : `Point placed in 3D terrain: [${ptLat.toFixed(5)}, ${ptLng.toFixed(5)}]`);
                return;
            }
        }

        // If it was a clean click without significant dragging, raycast to select 3D device!
        if (dragDistanceRef.current < 6 && rendererRef.current && cameraRef.current) {
            const rect = rendererRef.current.domElement.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
            const intersects = raycaster.intersectObjects(interactiveObjectsRef.current, true);

            if (intersects.length > 0) {
                let obj: THREE.Object3D | null = intersects[0].object;
                while (obj && !obj.userData?.type && obj.parent) {
                    obj = obj.parent;
                }
                if (obj && obj.userData?.type) {
                    const { type, data } = obj.userData;
                    if (type === 'camera') {
                        if (onSelectCamera) onSelectCamera(data.id || data);
                        if (onSelectDevice) onSelectDevice('camera', data);
                    } else if (type === 'soil') {
                        if (onSelectDevice) onSelectDevice('soil', data);
                    } else if (type === 'water') {
                        if (onSelectDevice) onSelectDevice('water', data);
                    } else if (type === 'worker') {
                        if (onSelectDevice) onSelectDevice('worker', data);
                    } else if (type === 'drone') {
                        if (onSelectDevice) onSelectDevice('drone', data);
                    } else if (type === 'slope_point') {
                        if (onSelectDevice) onSelectDevice('slope_point', data);
                    }
                }
            }
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (viewMode !== 'orbit') return;
        sphericalRef.current.radius = Math.max(40, Math.min(650, sphericalRef.current.radius + e.deltaY * 0.4));
    };

    return (
        <div className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none">
            {/* Three.js Canvas Container */}
            <div 
                ref={containerRef}
                style={{ cursor: isAddingSlopePoint3D ? 'crosshair' : isDraggingRef.current ? 'grabbing' : 'grab' }}
                className="w-full h-full"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { isDraggingRef.current = false; }}
                onWheel={handleWheel}
            />

            {/* TOP BAR: 2D/3D Mode Switcher & View Modes */}
            <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
                <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
                    {/* Swap 2D / 3D Button */}
                    {onSwap2d3d && (
                        <button
                            type="button"
                            onClick={onSwap2d3d}
                            className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
                            title="Swap places: 2D map and 3D terrain window"
                        >
                            <span>⇄ {isMainFullView ? (isKa ? '2D-ს მთავარში გადაყვანა' : 'Swap to 2D Main') : (isKa ? '3D-ს მთავარში გადაყვანა' : 'Swap to 3D Main')}</span>
                        </button>
                    )}

                    {/* Switch to 2D Map Button */}
                    {onSwitchTo2D && (
                        <button
                            type="button"
                            onClick={onSwitchTo2D}
                            className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
                        >
                            <span>🗺️ {isKa ? '2D რუკა' : '2D Map'}</span>
                        </button>
                    )}

                    {/* 3D Add Point Button */}
                    <button
                        type="button"
                        onClick={() => {
                            setIsAddingSlopePoint3D(!isAddingSlopePoint3D);
                            toast.info(isAddingSlopePoint3D ? 'რეჟიმი გაუქმდა' : 'დააწკაპუნეთ 3D რელიეფზე წერტილის დასასმელად');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95 ${
                            isAddingSlopePoint3D
                                ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 animate-pulse'
                                : 'bg-amber-950/80 hover:bg-amber-900 border border-amber-600/70 text-amber-300 hover:text-white'
                        }`}
                        title={isKa ? 'დააწკაპუნეთ 3D რელიეფზე წერტილის დასასმელად' : 'Click anywhere on 3D terrain to add slope point'}
                    >
                        <Plus size={13} />
                        <span>{isAddingSlopePoint3D ? (isKa ? '📍 დააწკაპუნეთ რელიეფზე' : '📍 Click on Terrain') : (isKa ? '+ 3D წერტილი' : '+ 3D Slope Point')}</span>
                    </button>

                    {/* Back / Delete Last Point in 3D */}
                    {onDeleteLastPoint && (
                        <button
                            type="button"
                            onClick={onDeleteLastPoint}
                            className="px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
                            title={isKa ? 'ბოლო რედაქტირებული წერტილის წაშლა (Backspace / ⌫)' : 'Delete last edited point (Backspace / ⌫)'}
                        >
                            <Undo2 size={13} className="text-rose-400 stroke-[2.5]" />
                            <span>{isKa ? 'უკან' : 'Back'} ⌫</span>
                        </button>
                    )}

                    {/* Delete Slope in 3D */}
                    {onDeleteSlope && (
                        <button
                            type="button"
                            onClick={onDeleteSlope}
                            className="px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
                            title={isKa ? 'მთელი 3D რელიეფის წაშლა' : 'Delete whole slope profile'}
                        >
                            <Trash2 size={13} className="text-red-400" />
                            <span>{isKa ? 'წაშლა' : 'Delete Slope'}</span>
                        </button>
                    )}

                    {/* Focus Cameras in 3D Button */}
                    <button
                        type="button"
                        onClick={handleFocusCameras}
                        className="px-3 py-1.5 bg-blue-950/80 hover:bg-blue-900 border border-blue-600/70 text-blue-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xl backdrop-blur-md cursor-pointer transition-all active:scale-95"
                        title={isKa ? 'კამერების ცენტრში მოყვანა 3D ხედში' : 'Center & frame surveillance cameras in 3D'}
                    >
                        <Video size={13} className="text-blue-400" />
                        <span>📹 {isKa ? 'კამერები' : 'Cameras'}</span>
                    </button>

                    {/* Active 3D Badge */}
                    <div className="px-2.5 py-1.5 bg-emerald-950/90 text-emerald-400 border border-emerald-700/60 rounded-xl text-[11px] font-mono font-bold hidden md:flex items-center gap-1.5 shadow-xl backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>3D DEM</span>
                    </div>
                </div>

                {/* 3D Camera Angles: Orbit, Drone Cockpit, Camera Lens */}
                <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800/90 shadow-xl backdrop-blur-md pointer-events-auto text-xs">
                    <button
                        type="button"
                        onClick={() => setViewMode('orbit')}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                            viewMode === 'orbit' 
                                ? 'bg-cyan-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-white'
                        }`}
                        title="Free 360° Orbit Navigation"
                    >
                        <Compass size={12} /> {isKa ? '3D ორბიტა' : '3D Orbit'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode('drone_cockpit')}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                            viewMode === 'drone_cockpit' 
                                ? 'bg-cyan-600 text-white shadow-sm animate-pulse' 
                                : 'text-slate-400 hover:text-white'
                        }`}
                        title="First-Person Drone Cockpit View"
                    >
                        <Navigation size={12} /> {isKa ? 'დრონის კაბინა (Cockpit)' : 'Drone Eye View'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode('camera_fov')}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                            viewMode === 'camera_fov' 
                                ? 'bg-blue-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-white'
                        }`}
                        title="Surveillance Camera POV"
                    >
                        <CameraIcon size={12} /> {isKa ? 'კამერის POV' : 'Camera Lens'}
                    </button>
                </div>
            </div>

            {/* COLLISION WARNING FLOATING HUD */}
            {collisionCheck.hasCollisionWarning && (
                <div className="absolute top-16 left-3 z-20 p-2.5 bg-red-950/90 border border-red-500/80 rounded-xl shadow-2xl text-xs text-red-200 flex items-center gap-2 backdrop-blur-md animate-bounce">
                    <AlertTriangle size={16} className="text-red-400" />
                    <span>
                        <b>{isKa ? 'შეჯახების საფრთხე:' : 'Terrain Collision Alert:'}</b> {isKa ? 'დრონის სიმაღლე 6მ-ზე დაბალია რელიეფის ბორცვზე' : 'Flight clearance < 6m above ridge crest'}
                    </span>
                </div>
            )}

            {/* BOTTOM FLOATING CONTROLS HUD */}
            <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                {/* 3D Visual Layer Toggles */}
                <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-950/90 border border-slate-800 rounded-xl shadow-xl backdrop-blur-md pointer-events-auto text-[11px]">
                    <button
                        type="button"
                        onClick={() => setShowFrustums(!showFrustums)}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
                            showFrustums ? 'bg-blue-600/80 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <ShieldCheck size={12} /> {isKa ? '3D ოპტიკური კონუსი' : '3D Frustums'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowTerrainShadows(!showTerrainShadows)}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
                            showTerrainShadows ? 'bg-red-600/80 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <AlertTriangle size={12} /> {isKa ? 'ფერდობის ბრმა ზონები' : 'Slope Shadows'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowContourGrid(!showContourGrid)}
                        className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors ${
                            showContourGrid ? 'bg-emerald-600/80 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Layers size={12} /> {isKa ? 'რელიეფის იზოჰიფსები' : 'Contour Grid'}
                    </button>

                    {/* Vertical Exaggeration Slider */}
                    <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-800 text-slate-300">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                            {isKa ? 'რელიეფის მასშტაბი:' : 'Elevation Scale:'}
                        </span>
                        <input
                            type="range"
                            min="1.0"
                            max="3.0"
                            step="0.2"
                            value={elevationExaggeration}
                            onChange={(e) => setElevationExaggeration(Number(e.target.value))}
                            className="w-16 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
                        />
                        <span className="font-mono text-cyan-400 font-bold">{elevationExaggeration}x</span>
                    </div>
                </div>

                {/* Reset View Button */}
                <button
                    type="button"
                    onClick={() => {
                        sphericalRef.current = { radius: 320, theta: Math.PI / 4, phi: Math.PI / 3.2 };
                        setViewMode('orbit');
                    }}
                    className="p-2 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl shadow-xl backdrop-blur-md pointer-events-auto transition-colors"
                    title="Reset 3D Perspective"
                >
                    <RotateCcw size={14} />
                </button>
            </div>
        </div>
    );
};
