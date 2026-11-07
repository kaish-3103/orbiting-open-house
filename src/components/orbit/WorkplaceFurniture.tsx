import { createContext, useContext, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3, type Mesh } from 'three';
import desk from '@/assets/models/desk.glb.asset.json';
import chairDesk from '@/assets/models/chairDesk.glb.asset.json';
import computerScreen from '@/assets/models/computerScreen.glb.asset.json';
import computerKeyboard from '@/assets/models/computerKeyboard.glb.asset.json';
import computerMouse from '@/assets/models/computerMouse.glb.asset.json';
import bedDouble from '@/assets/models/bedDouble.glb.asset.json';
import bookcaseOpen from '@/assets/models/bookcaseOpen.glb.asset.json';
import books from '@/assets/models/books.glb.asset.json';
import loungeSofa from '@/assets/models/loungeSofa.glb.asset.json';
import loungeChair from '@/assets/models/loungeChair.glb.asset.json';
import tableCoffee from '@/assets/models/tableCoffee.glb.asset.json';
import tableRound from '@/assets/models/tableRound.glb.asset.json';
import pottedPlant from '@/assets/models/pottedPlant.glb.asset.json';
import lampRoundFloor from '@/assets/models/lampRoundFloor.glb.asset.json';
import lampRoundTable from '@/assets/models/lampRoundTable.glb.asset.json';
import kitchenCabinet from '@/assets/models/kitchenCabinet.glb.asset.json';
import kitchenSink from '@/assets/models/kitchenSink.glb.asset.json';
import kitchenCoffeeMachine from '@/assets/models/kitchenCoffeeMachine.glb.asset.json';
import kitchenFridge from '@/assets/models/kitchenFridge.glb.asset.json';
import chair from '@/assets/models/chair.glb.asset.json';
import { planToWorld } from '@/lib/house-scene';
import { layoutPoint, type SpaceStyle } from '@/lib/layout';
const LayoutContext=createContext<SpaceStyle>('loft');

const models = { desk, chairDesk, computerScreen, computerKeyboard, computerMouse, bedDouble, bookcaseOpen, books, loungeSofa, loungeChair, tableCoffee, tableRound, pottedPlant, lampRoundFloor, lampRoundTable, kitchenCabinet, kitchenSink, kitchenCoffeeMachine, kitchenFridge, chair };

export function Furniture({ kind, x, y, width, elevation = 0, rotation = 0 }: { kind: keyof typeof models; x: number; y: number; width: number; elevation?: number; rotation?: number }) {
  const { scene } = useGLTF(models[kind].url);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const scale = width / Math.max(size.x, size.z);
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);
    clone.traverse(child => { if ((child as Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    return clone;
  }, [scene, width]);
  const [wx, , wz] = planToWorld(layoutPoint({x,y},useContext(LayoutContext)));
  return <group position={[wx, elevation, wz]} rotation-y={rotation}><primitive object={object} /></group>;
}

function Workstation({ x, y }: { x: number; y: number }) {
  return <>
    <Furniture kind="desk" x={x} y={y} width={1.6} />
    <Furniture kind="computerScreen" x={x} y={y - 12} width={0.58} elevation={0.78} />
    <Furniture kind="computerKeyboard" x={x} y={y + 17} width={0.4} elevation={0.79} />
    <Furniture kind="computerMouse" x={x + 33} y={y + 18} width={0.12} elevation={0.79} />
    <Furniture kind="chairDesk" x={x} y={y + 68} width={0.64} rotation={Math.PI} />
    <Furniture kind="lampRoundTable" x={x - 57} y={y - 10} width={0.26} elevation={0.78} />
    <Furniture kind="books" x={x + 53} y={y - 8} width={0.26} elevation={0.79} />
  </>;
}

export function WorkplaceFurniture({style='loft'}:{style?:SpaceStyle}) { return <LayoutContext.Provider value={style}><FurnitureLayout style={style} /></LayoutContext.Provider>; }
function FurnitureLayout({style}:{style:SpaceStyle}) {
  if(style==='office') return <group>
    {[[180,120],[420,120],[770,120],[1010,120],[180,500],[425,500]].map(([x,y],i)=><Workstation key={i} x={x ?? 0} y={y ?? 0} />)}
    {[[85,275],[565,270],[660,270],[1120,270],[575,665]].map(([x,y],i)=><Furniture key={i} kind="kitchenCabinet" x={x ?? 0} y={y ?? 0} width={0.62} />)}
    <Furniture kind="tableRound" x={900} y={590} width={1.6} />
    {[[800,590],[1000,590],[900,490],[900,690]].map(([x,y],i)=><Furniture key={i} kind="chairDesk" x={x ?? 0} y={y ?? 0} width={0.58} />)}
    <Furniture kind="kitchenCabinet" x={1100} y={550} width={0.65} />
    <Furniture kind="kitchenCoffeeMachine" x={1100} y={550} width={0.3} elevation={0.75} />
    {[[75,450],[620,700],[1120,700]].map(([x,y],i)=><Furniture key={i} kind="pottedPlant" x={x ?? 0} y={y ?? 0} width={0.5} />)}
  </group>;
  if(style==='lounge') return <group>
    {[[250,150],[880,150],[330,590],[910,590]].map(([x,y],i)=><group key={i}>
      <Furniture kind="loungeSofa" x={x ?? 0} y={(y ?? 0)+75} width={1.9} />
      <Furniture kind="tableCoffee" x={x ?? 0} y={y ?? 0} width={1.1} />
      <Furniture kind="loungeChair" x={(x ?? 0)-125} y={y ?? 0} width={0.8} rotation={Math.PI/2} />
      <Furniture kind="lampRoundFloor" x={(x ?? 0)+125} y={(y ?? 0)+65} width={0.36} />
      <Furniture kind="books" x={x ?? 0} y={y ?? 0} width={0.25} elevation={0.34} />
    </group>)}
    <Furniture kind="bookcaseOpen" x={535} y={130} width={0.6} rotation={-Math.PI/2} />
    <Furniture kind="kitchenCabinet" x={1100} y={490} width={0.65} />
    <Furniture kind="kitchenCoffeeMachine" x={1100} y={490} width={0.3} elevation={0.75} />
    {[[75,290],[630,290],[75,690],[1130,690]].map(([x,y],i)=><Furniture key={i} kind="pottedPlant" x={x ?? 0} y={y ?? 0} width={0.5} />)}
  </group>;
  return <group>
    <Workstation x={415} y={120} /><Workstation x={775} y={120} />
    <Furniture kind="bedDouble" x={145} y={178} width={1.85} />
    <Furniture kind="bedDouble" x={1050} y={178} width={1.85} />
    <Furniture kind="bookcaseOpen" x={265} y={73} width={0.85} />
    <Furniture kind="bookcaseOpen" x={935} y={73} width={0.85} />
    <Furniture kind="loungeSofa" x={350} y={675} width={3.0} />
    <Furniture kind="loungeChair" x={140} y={572} width={0.95} rotation={Math.PI / 2} />
    <Furniture kind="tableCoffee" x={340} y={580} width={1.6} />
    <Furniture kind="books" x={310} y={575} width={0.34} elevation={0.48} />
    <Furniture kind="lampRoundFloor" x={550} y={670} width={0.44} />
    <Furniture kind="bookcaseOpen" x={592} y={566} width={0.8} rotation={-Math.PI/2} />
    <Furniture kind="tableRound" x={890} y={605} width={1.6} />
    {[[790,605,Math.PI/2],[990,605,-Math.PI/2],[890,505,0],[890,705,Math.PI]].map(([x,y,r], i) => <Furniture key={i} kind="chair" x={x ?? 0} y={y ?? 0} width={0.55} rotation={r ?? 0} />)}
    <Furniture kind="kitchenFridge" x={1107} y={474} width={0.64} rotation={-Math.PI/2} />
    <Furniture kind="kitchenCabinet" x={1107} y={546} width={0.64} rotation={-Math.PI/2} />
    <Furniture kind="kitchenCoffeeMachine" x={1107} y={546} width={0.34} elevation={0.75} rotation={-Math.PI/2} />
    <Furniture kind="kitchenSink" x={1107} y={620} width={0.64} rotation={-Math.PI/2} />
    {[[74,295],[1120,295],[74,465],[604,690],[735,700]].map(([x,y], i) => <Furniture key={i} kind="pottedPlant" x={x ?? 0} y={y ?? 0} width={0.48} />)}
  </group>;
}