import React from 'react';
import { createRoot } from 'react-dom/client';
import { WeatherStationLab } from '../src/components/SystemManagement/HardwareLabs/WeatherStationLab';
import { Go2rtcVideoStream } from '../src/components/SystemManagement/HardwareLabs/Go2rtcVideoStream';
createRoot(document.getElementById('root')!).render(<><WeatherStationLab mapCenter={[42,42]}/><Go2rtcVideoStream streamSrc="test_one" cameraName="Test camera one"/><Go2rtcVideoStream streamSrc="test_two" cameraName="Test camera two"/></>);
