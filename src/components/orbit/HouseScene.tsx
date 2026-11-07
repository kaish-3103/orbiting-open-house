import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace, Vector3, PCFShadowMap, type OrthographicCamera, type Group } from 'three';
import type { Track } from 'livekit-client';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { DOORS, ROOMS, type RoomKey } from '@/lib/house';
import { planToWorld, worldToPlan } from '@/lib/house-scene';
import { layoutPoint, type SpaceStyle } from '@/lib/layout';
import type { FloorPlanProps, PlanAvatar } from './FloorPlan';
import { Furniture, WorkplaceFurniture } from './WorkplaceFurniture';

type Palette = Record<string, string> & { card: string; floor: string; wood: string; sage: string; lavender: string; sky: string };

function Html({ children, position = [0,0,0], ..._unused }: { children: ReactNode; position?: [number,number,number]; center?: boolean; zIndexRange?: number[]; style?: { pointerEvents: string } }) {
  const { gl, camera, size } = useThree();
  const group=useRef<Group>(null); const div=useRef<HTMLDivElement>(null);
  const point=useMemo(()=>new Vector3(),[]);
  const [root,setRoot]=useState<ReturnType<typeof createRoot>|null>(null);
  useEffect(()=>{
    const el=document.createElement('div'); el.className='absolute top-0 left-0';
    el.style.pointerEvents=_unused.style?.pointerEvents==='none'?'none':'auto'; el.style.zIndex=String(_unused.zIndexRange?.[0] ?? 1);
    div.current=el; gl.domElement.parentElement?.appendChild(el);
    const domRoot=createRoot(el); setRoot(domRoot);
    return ()=>{ el.remove(); div.current=null; queueMicrotask(()=>domRoot.unmount()); };
  },[gl]);
  useEffect(()=>{ root?.render(children); },[root,children]);
  useFrame(()=>{ if(!group.current || !div.current) return; group.current.getWorldPosition(point); point.project(camera); div.current.style.transform=`translate(-50%, -50%) translate(${(point.x+1)*size.width/2}px,${(1-point.y)*size.height/2}px)`; });
  return <group ref={group} position={position} />;
}
function readPalette(): Palette {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const css = getComputedStyle(document.documentElement);
  const result: Palette = { card:'',floor:'',wood:'',sage:'',lavender:'',sky:'' };
  for (const token of ['card','floor','wall','wood','wood-dark','fabric','sky','honey','sage','coral','lavender','live','room-bedroom','room-bedroom2','room-hall','room-lounge','room-kitchen','scene-wall','scene-light','scene-grout','scene-lounge-floor','scene-lounge-wall','scene-lounge-rug','scene-office-floor','scene-office-wall']) {
    if (!ctx) continue;
    ctx.fillStyle = css.getPropertyValue(`--${token}`).trim();
    ctx.fillRect(0,0,1,1);
    const pixel = ctx.getImageData(0,0,1,1).data;
    result[token] = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
  }
  return result;
}

function FloorTexture({ palette }: { palette: Palette }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const c = canvas.getContext('2d');
    if (c) {
      c.fillStyle = palette.floor ?? ''; c.fillRect(0,0,1024,512);
      for(let y=0;y<512;y+=32) {
        c.strokeStyle = palette['wood-dark'] ?? ''; c.globalAlpha=0.17;
        c.beginPath(); c.moveTo(0,y); c.lineTo(1024,y); c.stroke();
        for(let x=(y%64===0?0:80);x<1024;x+=160) { c.beginPath(); c.moveTo(x,y); c.lineTo(x,y+32); c.stroke(); }
        c.globalAlpha=0.04;
        for(let i=0;i<8;i++) { c.beginPath();c.moveTo(0,y+i*4+2);c.lineTo(1024,y+i*4+3);c.stroke(); }
      }
    }
    const t = new CanvasTexture(canvas); t.colorSpace=SRGBColorSpace; return t;
  },[palette]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation-x={-Math.PI/2} receiveShadow><planeGeometry args={[11.2,7]} /><meshStandardMaterial map={texture} roughness={0.87} /></mesh>;
}

function Box({ position, size, color }: { position: [number,number,number]; size: [number,number,number]; color: string | undefined }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial {...(color ? {color} : {})} roughness={0.76} /></mesh>;
}

function AvatarCamera({ track, isMe }: { track: Track; isMe?: boolean | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const el=ref.current; if(!el) return; track.attach(el); return () => { track.detach(el); el.srcObject=null; }; },[track]);
  return <video ref={ref} autoPlay playsInline muted className={`h-full w-full object-cover ${isMe ? '-scale-x-100' : ''}`} />;
}

function Avatar({ avatar, onClick, palette, spaceStyle }: { avatar: PlanAvatar; spaceStyle:SpaceStyle; onClick: FloorPlanProps['onAvatarClick']; palette: Palette }) {
  const ref = useRef<Group>(null);
  const a=avatar;
  useFrame(() => { if(ref.current) { const [x,,z]=planToWorld(layoutPoint(a,spaceStyle)); ref.current.position.set(x,0.22,z); } });
  return <group ref={ref} position={planToWorld(layoutPoint(a,spaceStyle))}>
    <mesh rotation-x={-Math.PI/2}><ringGeometry args={[0.24,0.3,32]} /><meshBasicMaterial color={palette[a.inVoice ? 'live' : a.color] ?? palette.sage} /></mesh>
    <Html center position={[0,0.65,0]} zIndexRange={[20,0]}>
      <div className="flex w-24 flex-col items-center">
        <Button aria-label={`About ${a.name}`} variant="ghost" onClick={e=>{ e.stopPropagation(); onClick?.(a.id); }} className={`h-9 w-9 sm:h-12 sm:w-12 overflow-hidden rounded-full border-2 border-card p-0 shadow-float ${({sage:'bg-sage',sky:'bg-sky',lavender:'bg-lavender',honey:'bg-honey',coral:'bg-coral'} as Record<string,string>)[a.color] ?? 'bg-sage'}`}>
          {a.track ? <AvatarCamera track={a.track} isMe={a.isMe} /> : <span className="text-lg font-semibold text-foreground">{a.name.slice(0,1)}</span>}
        </Button>
        <span className="mt-1 max-w-24 truncate rounded-md bg-chrome px-2 py-0.5 text-xs font-medium text-chrome-foreground">{a.name}</span>
      </div>
    </Html>
  </group>;
}

function Scene({ props, palette, reset, spaceStyle }: { props: FloorPlanProps; palette: Palette; reset: number; spaceStyle: SpaceStyle }) {
  const controls=useRef<OrbitControlsType>(null);
  const map=(p:{x:number;y:number})=>planToWorld(layoutPoint(p,spaceStyle));
  const { camera, size, gl } = useThree();
  useEffect(()=>{
    const c=camera as OrthographicCamera;
    c.position.set(0,12,10); c.lookAt(0,0,0); c.zoom=Math.min(size.width/12.2,size.height/8.8); c.updateProjectionMatrix();
    controls.current?.target.set(0,0,0); controls.current?.update();
  },[camera,size,reset]);
  useFrame(()=>{ gl.domElement.parentElement?.setAttribute('data-scene-ready','true'); });
  const walls: [number,number,number,number][] = [[40,40,1160,40],[40,40,40,740],[1160,40,1160,740],[580,40,580,340],[620,40,620,340],[660,420,660,740],[700,420,700,740]];
  for(const k of Object.keys(DOORS) as (keyof typeof DOORS)[]) { const r=ROOMS[k].rect,d=DOORS[k]; walls.push([r.x,d.wallY,d.x0,d.wallY],[d.x1,d.wallY,r.x+r.w,d.wallY]); }
  return <>
    <ambientLight intensity={0.45} />
    <directionalLight position={[-3,9,-5]} intensity={1.7} color={palette['scene-light'] ?? palette.card} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-8} shadow-normalBias={0.04} />
    <Environment resolution={64}><Lightformer intensity={2} position={[0,5,0]} scale={[12,8,1]} rotation-x={-Math.PI/2} /><Lightformer color={palette.sky} intensity={1} position={[-6,2,0]} rotation-y={Math.PI/2} scale={[5,5,1]} /></Environment>
    <Box position={[0,-0.15,0]} size={[11.6,0.28,7.4]} color={palette['wood-dark']} />
    <group position={[0,0.015,0]}><FloorTexture palette={palette} /></group>
    {(Object.keys(ROOMS) as RoomKey[]).map(k=>{
      const r=ROOMS[k].rect,[x,,z]=map({x:r.x+r.w/2,y:r.y+r.h/2});
      const setting=props.settings?.find(s=>s.room_key===k);
      return <group key={k}>
        <mesh position={[x,0.025,z]} rotation-x={-Math.PI/2} receiveShadow onClick={e=>{ if(e.delta>5) return; e.stopPropagation(); props.onFloorClick?.(layoutPoint(worldToPlan(e.point.x,e.point.z),spaceStyle,true)); }}>
          <planeGeometry args={[(layoutPoint({x:r.x+r.w,y:r.y},spaceStyle).x-layoutPoint({x:r.x,y:r.y},spaceStyle).x)/100,(layoutPoint({x:r.x,y:r.y+r.h},spaceStyle).y-layoutPoint({x:r.x,y:r.y},spaceStyle).y)/100]} /><meshStandardMaterial color={palette[setting?.palette ?? `room-${k==='hallway'?'hall':k==='bedroom1'?'bedroom':k}`] ?? palette.floor} transparent opacity={0.32} roughness={0.9} />
        </mesh>
        <Html position={[x,0.04,map({x:r.x,y:r.y+30})[2]]} center zIndexRange={[1,0]} style={{pointerEvents:'none'}}><span className="whitespace-nowrap hidden sm:inline whitespace-nowrap rounded bg-card/80 px-1 text-[10px] font-semibold text-muted-foreground">{setting?.name ?? ROOMS[k].label}{props.doors?.[k]?.ownerName ? ` · ${props.doors[k]?.ownerName}` : ''}</span></Html>
      </group>;
    })}
    {walls.map(([x1,y1,x2,y2],i)=>{
      const [x,,z]=map({x:(x1+x2)/2,y:(y1+y2)/2}); const outer=i<3; const height=outer?0.85:0.42;
      return <Box key={i} position={[x,height/2,z]} size={[Math.max(Math.abs(layoutPoint({x:x2,y:y2},spaceStyle).x-layoutPoint({x:x1,y:y1},spaceStyle).x)/100,0.08),height,Math.max(Math.abs(layoutPoint({x:x2,y:y2},spaceStyle).y-layoutPoint({x:x1,y:y1},spaceStyle).y)/100,0.08)]} color={palette['scene-wall']} />;
    })}
    {Object.entries(DOORS).map(([key,d])=>{
      const state=props.doors?.[key as RoomKey]?.state ?? 'open'; const [x,,z]=map({x:(d.x0+d.x1)/2,y:d.wallY});
      return <group key={key}><Box position={[x,0.035,z]} size={[(layoutPoint({x:d.x1,y:d.wallY},spaceStyle).x-layoutPoint({x:d.x0,y:d.wallY},spaceStyle).x)/100,0.04,0.16]} color={palette.wood} />{key.startsWith('bedroom') && <Html center position={[x,0.2,z]} zIndexRange={[2,0]} style={{pointerEvents:'none'}}><span className="rounded bg-card px-1 text-xs shadow-soft">{state==='locked'?'🔒':state==='knock'?'✋':'🚪'}</span></Html>}</group>;
    })}
    <Box position={[-2.6,0.04,2.03]} size={[3.7,0.025,1.9]} color={palette.sage} />
    <Box position={[-2.7,0.04,-1.6]} size={[1.8,0.025,1.4]} color={palette.lavender} />
    <Box position={[2.7,0.04,-1.6]} size={[1.8,0.025,1.4]} color={palette.sky} />
    {[-3.6,3.6].map(x=><group key={x}><Box position={[x,0.9,-3.47]} size={[1.6,0.6,0.06]} color={palette.sky} />{[-0.7,0,0.7].map(dx=><Box key={dx} position={[x+dx,0.9,-3.43]} size={[0.035,0.65,0.035]} color={palette.card} />)}</group>)}
    <pointLight position={[-1.85,1.25,-2.8]} intensity={0.55} distance={2.2} color={palette['scene-light'] ?? palette.card} />
    <pointLight position={[1.2,1.25,-2.8]} intensity={0.55} distance={2.2} color={palette['scene-light'] ?? palette.card} />
    <pointLight position={[-0.5,1.5,2.8]} intensity={0.8} distance={3} color={palette['scene-light'] ?? palette.card} />
    <Suspense fallback={null}><WorkplaceFurniture key={spaceStyle} style={spaceStyle} /><AssetsReady /></Suspense>
    {props.settings?.map(s=><Suspense key={s.room_key} fallback={null}><DecorPlant room={s.room_key} decor={s.decor} /></Suspense>)}
    {props.avatars.map(a=><Avatar key={a.id} avatar={a} onClick={props.onAvatarClick} palette={palette} spaceStyle={spaceStyle} />)}
    <OrbitControls ref={controls} enablePan={false} enableZoom={false} minPolarAngle={0.2} maxPolarAngle={Math.PI/2.5} enableDamping />
  </>;
}

function DecorPlant({room,decor}:{room:string;decor:string}) { const r=ROOMS[room as RoomKey]?.rect; return r?<Furniture kind={decor==='books'?'bookcaseOpen':decor==='plant'?'pottedPlant':'loungeChair'} x={r.x+r.w-50} y={r.y+r.h-50} width={0.6} />:null; }

function AssetsReady() { const {gl}=useThree(); useEffect(()=>{ gl.domElement.parentElement?.setAttribute('data-assets-ready','true'); },[gl]); return null; }

export default function HouseScene({spaceStyle='loft',...props}: FloorPlanProps & {spaceStyle?:SpaceStyle}) {
  const [base]=useState(readPalette); const [reset,setReset]=useState(0);
  const palette=useMemo(()=>({...base, floor:base[spaceStyle==='lounge'?'scene-lounge-floor':spaceStyle==='office'?'scene-office-floor':'floor'] ?? base.floor, 'scene-wall':base[spaceStyle==='lounge'?'scene-lounge-wall':spaceStyle==='office'?'scene-office-wall':'scene-wall'] ?? base.card, sage:spaceStyle==='lounge'?(base['scene-lounge-rug'] ?? base.sage):base.sage}),[base,spaceStyle]);
  return <div className="relative h-full w-full overflow-hidden" aria-label="Three-dimensional workplace">
    <Canvas frameloop="demand" orthographic shadows={{type:PCFShadowMap}} dpr={[1,1.5]} camera={{position:[0,12,10],near:0.1,far:80}}><Scene props={props} palette={palette} reset={reset} spaceStyle={spaceStyle} /></Canvas>
    <Button size="icon" variant="outline" className="absolute right-3 bottom-3 bg-card" title="Reset house view" aria-label="Reset house view" onClick={()=>setReset(n=>n+1)}><RotateCcw /></Button>
  </div>;
}