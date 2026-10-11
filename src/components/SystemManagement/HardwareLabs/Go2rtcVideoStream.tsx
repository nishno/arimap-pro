import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
export interface Go2rtcVideoStreamProps {
 streamSrc:string; rtspUrl?:string; cameraName?:string; channelNumber?:number;
 go2rtcHost?:string; isMutedDefault?:boolean; showControls?:boolean;
 aspectRatio?:'16/9'|'4/3'|'auto';className?:string;onSnapshotTaken?:(dataUrl:string)=>void;
}
/** Browser playback adapter. RTSP credentials and gateway configuration stay server-side. */
export const Go2rtcVideoStream: React.FC<Go2rtcVideoStreamProps> = ({streamSrc,cameraName='Camera',isMutedDefault=true,showControls=true,aspectRatio='16/9',className='',onSnapshotTaken}) => {
 const video=useRef<HTMLVideoElement>(null);
 const [status,setStatus]=useState('Not connected');
 const [error,setError]=useState('');
 const valid=/^[A-Za-z0-9_-]{1,100}$/.test(streamSrc);
 const path=valid?`/api/cameras/${streamSrc}/index.m3u8`:'';
 useEffect(()=>{
  setStatus('Connecting');setError('');
  if(!valid){setError('Register a valid camera stream on the gateway.');return;}
  const element=video.current!;let hls:Hls|undefined;
  if(element.canPlayType('application/vnd.apple.mpegurl'))element.src=path;
  else if(Hls.isSupported()){
   hls=new Hls({maxBufferLength:10,xhrSetup:xhr=>{xhr.withCredentials=true;}});
   hls.loadSource(path);hls.attachMedia(element);
   hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal){setStatus('Offline');setError('Camera gateway unavailable or access denied. No live picture is available.');hls?.stopLoad();}});
  }else setError('This browser cannot play HLS streams.');
  return()=>{hls?.destroy();element.pause();element.removeAttribute('src');element.load();};
 },[path,valid]);
 function snapshot(){
  const element=video.current;
  if(!element||!element.videoWidth){setError('Wait for a live picture before taking a snapshot.');return;}
  try{const canvas=document.createElement('canvas');canvas.width=element.videoWidth;canvas.height=element.videoHeight;canvas.getContext('2d')!.drawImage(element,0,0);onSnapshotTaken?.(canvas.toDataURL('image/jpeg'));}catch{setError('Snapshot unavailable for this stream.');}
 }
 return <div className={`bg-slate-950 rounded-xl p-3 text-white ${className}`}><div className="flex justify-between gap-2 text-xs mb-2"><b>{cameraName}</b><span role="status">{error?'Offline':status}</span></div><video ref={video} aria-label={`${cameraName} video`} autoPlay muted={isMutedDefault} controls={showControls} playsInline preload="metadata" onPlaying={()=>setStatus('Live')} onWaiting={()=>setStatus('Buffering')} onError={()=>{setStatus('Offline');setError('No live picture. Check the camera gateway and your access.');}} style={{width:'100%',aspectRatio:aspectRatio==='auto'?'16/9':aspectRatio,background:'#000'}}/>{error&&<p role="alert" className="text-xs text-amber-300 mt-3">{error}</p>}{showControls&&<div className="flex justify-between items-center mt-3 gap-3 text-xs"><p>Private gateway stream · {streamSrc}</p>{onSnapshotTaken&&<button type="button" onClick={snapshot} className="border rounded px-3 py-2">Snapshot</button>}</div>}</div>;
};
