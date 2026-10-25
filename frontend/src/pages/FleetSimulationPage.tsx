import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  Truck, 
  Bike, 
  Car,
  Navigation, 
  Radio, 
  Clock, 
  Battery, 
  ThermometerSnowflake, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Filter, 
  Gauge, 
  ArrowRight, 
  Crosshair, 
  MapPin,
  Flag,
  Volume2,
  VolumeX,
  Sparkles,
  Timer,
  Compass,
  FileText
} from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { KPICard } from '../components/KPICard';
import { useAppStore } from '../store/useAppStore';
import { soundEffects } from '../utils/audioEffects';
import { 
  computeRoadRoute, 
  calculateBearing, 
  getDistanceKm, 
  RoutePoint, 
  RoutePlanResult 
} from '../utils/routePlanner';
import { downloadWaybillPdf } from '../utils/generateWaybillPdf';

// ============================================================================
// 1. REAL GEOGRAPHIC COORDINATES & ROAD NETWORK (KOLHAPUR REGION)
// ============================================================================

export interface MapNode {
  id: string;
  name: string;
  type: 'warehouse' | 'hospital' | 'darkstore' | 'junction';
  lat: number;
  lng: number;
  address: string;
  code: string;
}

export interface MapEdge {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  roadType: 'expressway' | 'arterial' | 'local' | 'skyway';
  baseSpeedKmH: number;
  trafficFactor: number; // 1.0 = clear, 1.4 = moderate, 2.5 = heavy
  incident?: string;
  waypoints: [number, number][];
}

export interface Vehicle {
  id: string;
  name: string;
  type: 'drone' | 'ev_bike' | 'reefer_van' | 'heavy_truck';
  plate: string;
  driver: string;
  speedKmH: number;
  maxSpeedKmH: number;
  batteryPct: number;
  tempC: number;
  targetTempC: number;
  cargo: string;
  capacityUnits: number;
  currentUnits: number;
  status: 'en_route' | 'delivered' | 'docking' | 'idle';
  originId: string;
  destinationId: string;
  pathNodeIds: string[];
  currentEdgeIndex: number;
  progressOnEdge: number;
  totalDistanceKm: number;
  etaMinutes: number;
  dijkstraTimeMs: number;
  color: string;
}

// Real Geographical Points in Kolhapur Metropolis
const KOLHAPUR_NODES: MapNode[] = [
  // Warehouses (Fulfillment & Cold-Chain Hubs)
  { 
    id: 'wh_shiroli_midc', 
    name: 'Shiroli MIDC Logistics Hub (KL-001)', 
    type: 'warehouse', 
    lat: 16.7410, 
    lng: 74.2750, 
    address: 'NH-48 Industrial Corridor, Shiroli MIDC', 
    code: 'KL-001' 
  },
  { 
    id: 'wh_gokul_shirgaon', 
    name: 'Gokul Shirgaon Cold Chain Hub (KL-002)', 
    type: 'warehouse', 
    lat: 16.6350, 
    lng: 74.2810, 
    address: 'Gokul Dairy Pharma Zone, Shirgaon MIDC', 
    code: 'KL-002' 
  },
  { 
    id: 'wh_kagal_midc', 
    name: 'Kagal 5-Star MIDC Logistics Node (KL-003)', 
    type: 'warehouse', 
    lat: 16.5820, 
    lng: 74.3200, 
    address: '5-Star Industrial Area, Kagal Highway', 
    code: 'KL-003' 
  },

  // Key Interchanges & Arterial Road Junctions
  { 
    id: 'j_kawala_naka', 
    name: 'Kawala Naka Central Gateway (J-01)', 
    type: 'junction', 
    lat: 16.7020, 
    lng: 74.2490, 
    address: 'Central Highway & Station Rd Crossing', 
    code: 'J-01' 
  },
  { 
    id: 'j_tawde_hotel', 
    name: 'Tawde Hotel NH-48 Flyover (J-02)', 
    type: 'junction', 
    lat: 16.7190, 
    lng: 74.2670, 
    address: 'Pune-Bangalore NH-48 Entry Junction', 
    code: 'J-02' 
  },
  { 
    id: 'j_dabholkar_corner', 
    name: 'Dabholkar Corner Station Node (J-03)', 
    type: 'junction', 
    lat: 16.7005, 
    lng: 74.2385, 
    address: 'Shahupuri / Railway Station Rd', 
    code: 'J-03' 
  },
  { 
    id: 'j_rankala_gate', 
    name: 'Rankala Lake Western Gateway (J-04)', 
    type: 'junction', 
    lat: 16.6890, 
    lng: 74.2120, 
    address: 'Rankala Chowpatty Western Bypass', 
    code: 'J-04' 
  },
  { 
    id: 'j_gandhinagar', 
    name: 'Gandhinagar Textile Crossing (J-05)', 
    type: 'junction', 
    lat: 16.6980, 
    lng: 74.2880, 
    address: 'Gandhinagar-Ichalkaranji Link Expressway', 
    code: 'J-05' 
  },

  // Clinical & Emergency Healthcare Destinations
  { 
    id: 'hosp_cpr', 
    name: 'Chhatrapati Pramila Raje (CPR) Trauma Hospital', 
    type: 'hospital', 
    lat: 16.6945, 
    lng: 74.2250, 
    address: 'Bhausingji Road, Dasara Chowk', 
    code: 'H-CPR' 
  },
  { 
    id: 'hosp_aster_aadhar', 
    name: 'Aster Aadhar Super Specialty Hospital', 
    type: 'hospital', 
    lat: 16.6710, 
    lng: 74.2380, 
    address: 'R.S. No. 1104P, Shastri Nagar', 
    code: 'H-AST' 
  },
  { 
    id: 'hosp_dypatil', 
    name: 'D.Y. Patil Medical College & Hospital', 
    type: 'hospital', 
    lat: 16.7150, 
    lng: 74.2540, 
    address: 'Line Bazaar, Kasaba Bawada', 
    code: 'H-DYP' 
  },

  // Quick-Commerce Dark Stores & Rapid Fulfillment Pods
  { 
    id: 'store_rajarampuri', 
    name: 'Rajarampuri 10-Min Fast Dark Store', 
    type: 'darkstore', 
    lat: 16.6910, 
    lng: 74.2460, 
    address: 'Rajarampuri 3rd Lane Commercial Enclave', 
    code: 'DS-RJP' 
  },
  { 
    id: 'store_kasaba_bawada', 
    name: 'Kasaba Bawada Express Depot', 
    type: 'darkstore', 
    lat: 16.7280, 
    lng: 74.2390, 
    address: 'Sugar Mill Corridor, Kasaba Bawada', 
    code: 'DS-KSB' 
  },
  { 
    id: 'store_uchgaon', 
    name: 'Uchgaon Rapid Distribution Pod', 
    type: 'darkstore', 
    lat: 16.6850, 
    lng: 74.2720, 
    address: 'Uchgaon Industrial Bypass', 
    code: 'DS-UCH' 
  },
];

// Real Road Network with Accurate Kolhapur Lat/Lng Coordinates
const KOLHAPUR_EDGES: MapEdge[] = [
  {
    id: 'e1',
    from: 'wh_shiroli_midc',
    to: 'j_tawde_hotel',
    distanceKm: 4.2,
    roadType: 'expressway',
    baseSpeedKmH: 75,
    trafficFactor: 1.0,
    waypoints: [[16.7410, 74.2750], [16.7300, 74.2710], [16.7190, 74.2670]]
  },
  {
    id: 'e2',
    from: 'j_tawde_hotel',
    to: 'j_kawala_naka',
    distanceKm: 2.5,
    roadType: 'arterial',
    baseSpeedKmH: 55,
    trafficFactor: 1.1,
    waypoints: [[16.7190, 74.2670], [16.7110, 74.2580], [16.7020, 74.2490]]
  },
  {
    id: 'e3',
    from: 'j_kawala_naka',
    to: 'j_dabholkar_corner',
    distanceKm: 1.2,
    roadType: 'arterial',
    baseSpeedKmH: 45,
    trafficFactor: 1.2,
    waypoints: [[16.7020, 74.2490], [16.7012, 74.2435], [16.7005, 74.2385]]
  },
  {
    id: 'e4',
    from: 'j_dabholkar_corner',
    to: 'hosp_cpr',
    distanceKm: 1.6,
    roadType: 'local',
    baseSpeedKmH: 40,
    trafficFactor: 1.0,
    waypoints: [[16.7005, 74.2385], [16.6975, 74.2320], [16.6945, 74.2250]]
  },
  {
    id: 'e5',
    from: 'hosp_cpr',
    to: 'j_rankala_gate',
    distanceKm: 1.8,
    roadType: 'local',
    baseSpeedKmH: 40,
    trafficFactor: 1.0,
    waypoints: [[16.6945, 74.2250], [16.6920, 74.2185], [16.6890, 74.2120]]
  },
  {
    id: 'e6',
    from: 'j_rankala_gate',
    to: 'hosp_aster_aadhar',
    distanceKm: 3.4,
    roadType: 'arterial',
    baseSpeedKmH: 50,
    trafficFactor: 1.0,
    waypoints: [[16.6890, 74.2120], [16.6790, 74.2240], [16.6710, 74.2380]]
  },
  {
    id: 'e7',
    from: 'j_kawala_naka',
    to: 'store_rajarampuri',
    distanceKm: 1.5,
    roadType: 'local',
    baseSpeedKmH: 40,
    trafficFactor: 1.1,
    waypoints: [[16.7020, 74.2490], [16.6965, 74.2475], [16.6910, 74.2460]]
  },
  {
    id: 'e8',
    from: 'store_rajarampuri',
    to: 'hosp_aster_aadhar',
    distanceKm: 2.4,
    roadType: 'arterial',
    baseSpeedKmH: 50,
    trafficFactor: 1.0,
    waypoints: [[16.6910, 74.2460], [16.6810, 74.2420], [16.6710, 74.2380]]
  },
  {
    id: 'e9',
    from: 'hosp_aster_aadhar',
    to: 'wh_gokul_shirgaon',
    distanceKm: 5.8,
    roadType: 'expressway',
    baseSpeedKmH: 65,
    trafficFactor: 1.0,
    waypoints: [[16.6710, 74.2380], [16.6530, 74.2580], [16.6350, 74.2810]]
  },
  {
    id: 'e10',
    from: 'j_kawala_naka',
    to: 'j_gandhinagar',
    distanceKm: 4.3,
    roadType: 'expressway',
    baseSpeedKmH: 70,
    trafficFactor: 1.0,
    waypoints: [[16.7020, 74.2490], [16.7000, 74.2680], [16.6980, 74.2880]]
  },
  {
    id: 'e11',
    from: 'j_gandhinagar',
    to: 'store_uchgaon',
    distanceKm: 2.1,
    roadType: 'local',
    baseSpeedKmH: 45,
    trafficFactor: 1.0,
    waypoints: [[16.6980, 74.2880], [16.6915, 74.2800], [16.6850, 74.2720]]
  },
  {
    id: 'e12',
    from: 'store_uchgaon',
    to: 'wh_gokul_shirgaon',
    distanceKm: 5.6,
    roadType: 'expressway',
    baseSpeedKmH: 75,
    trafficFactor: 1.0,
    waypoints: [[16.6850, 74.2720], [16.6600, 74.2765], [16.6350, 74.2810]]
  },
  {
    id: 'e13',
    from: 'wh_gokul_shirgaon',
    to: 'wh_kagal_midc',
    distanceKm: 7.2,
    roadType: 'expressway',
    baseSpeedKmH: 80,
    trafficFactor: 1.0,
    waypoints: [[16.6350, 74.2810], [16.6080, 74.3000], [16.5820, 74.3200]]
  },
  {
    id: 'e14',
    from: 'j_tawde_hotel',
    to: 'hosp_dypatil',
    distanceKm: 1.7,
    roadType: 'local',
    baseSpeedKmH: 45,
    trafficFactor: 1.0,
    waypoints: [[16.7190, 74.2670], [16.7170, 74.2600], [16.7150, 74.2540]]
  },
  {
    id: 'e15',
    from: 'hosp_dypatil',
    to: 'store_kasaba_bawada',
    distanceKm: 2.0,
    roadType: 'local',
    baseSpeedKmH: 45,
    trafficFactor: 1.0,
    waypoints: [[16.7150, 74.2540], [16.7210, 74.2460], [16.7280, 74.2390]]
  },
  {
    id: 'e16',
    from: 'store_kasaba_bawada',
    to: 'j_dabholkar_corner',
    distanceKm: 3.2,
    roadType: 'arterial',
    baseSpeedKmH: 50,
    trafficFactor: 1.1,
    waypoints: [[16.7280, 74.2390], [16.7140, 74.2385], [16.7005, 74.2385]]
  },
  // Drone Skyway Corridor (direct line of sight)
  {
    id: 'e_drone_1',
    from: 'wh_gokul_shirgaon',
    to: 'hosp_aster_aadhar',
    distanceKm: 6.1,
    roadType: 'skyway',
    baseSpeedKmH: 95,
    trafficFactor: 1.0,
    waypoints: [[16.6350, 74.2810], [16.6530, 74.2590], [16.6710, 74.2380]]
  }
];

// ============================================================================
// 2. DIJKSTRA SHORTEST PATH GRAPH ALGORITHM
// ============================================================================

export interface DijkstraResult {
  pathNodeIds: string[];
  totalDistanceKm: number;
  totalTimeMinutes: number;
  nodesExplored: number;
  computationTimeMs: number;
  fullCoordinates: [number, number][];
}

export function runDijkstraAlgorithm(
  startNodeId: string,
  endNodeId: string,
  edgeList: MapEdge[],
  nodeList: MapNode[],
  vehicleType: Vehicle['type'] = 'reefer_van'
): DijkstraResult {
  const startTime = performance.now();
  const nodeMap = new Map(nodeList.map(n => [n.id, n]));

  // Adjacency list
  const adj = new Map<string, { to: string; weightMinutes: number; distanceKm: number; waypoints: [number, number][] }[]>();
  nodeList.forEach(n => adj.set(n.id, []));

  edgeList.forEach(edge => {
    if (vehicleType === 'drone') {
      if (edge.roadType === 'skyway') {
        const timeMinutes = (edge.distanceKm / edge.baseSpeedKmH) * 60;
        adj.get(edge.from)?.push({ to: edge.to, weightMinutes: timeMinutes, distanceKm: edge.distanceKm, waypoints: edge.waypoints });
        adj.get(edge.to)?.push({ to: edge.from, weightMinutes: timeMinutes, distanceKm: edge.distanceKm, waypoints: [...edge.waypoints].reverse() });
      }
    } else {
      if (edge.roadType !== 'skyway') {
        const effectiveSpeed = Math.max(15, edge.baseSpeedKmH / edge.trafficFactor);
        const timeMinutes = (edge.distanceKm / effectiveSpeed) * 60;

        adj.get(edge.from)?.push({ to: edge.to, weightMinutes: timeMinutes, distanceKm: edge.distanceKm, waypoints: edge.waypoints });
        adj.get(edge.to)?.push({ to: edge.from, weightMinutes: timeMinutes, distanceKm: edge.distanceKm, waypoints: [...edge.waypoints].reverse() });
      }
    }
  });

  const dist = new Map<string, number>();
  const distKm = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const unvisited = new Set<string>();

  nodeList.forEach(n => {
    dist.set(n.id, Infinity);
    distKm.set(n.id, Infinity);
    prev.set(n.id, null);
    unvisited.add(n.id);
  });

  dist.set(startNodeId, 0);
  distKm.set(startNodeId, 0);

  let nodesExplored = 0;

  while (unvisited.size > 0) {
    let curr: string | null = null;
    let minD = Infinity;

    unvisited.forEach(nodeId => {
      const d = dist.get(nodeId)!;
      if (d < minD) {
        minD = d;
        curr = nodeId;
      }
    });

    if (curr === null || minD === Infinity) break;
    nodesExplored++;

    if (curr === endNodeId) break;

    unvisited.delete(curr);

    const neighbors = adj.get(curr) || [];
    for (const edge of neighbors) {
      if (!unvisited.has(edge.to)) continue;

      const altTime = dist.get(curr)! + edge.weightMinutes;
      if (altTime < dist.get(edge.to)!) {
        dist.set(edge.to, altTime);
        distKm.set(edge.to, distKm.get(curr)! + edge.distanceKm);
        prev.set(edge.to, curr);
      }
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let u: string | null = endNodeId;

  while (u !== null) {
    path.unshift(u);
    u = prev.get(u) || null;
    if (u === startNodeId) {
      path.unshift(startNodeId);
      break;
    }
  }

  const finalPath = path.length > 0 && path[0] === startNodeId ? path : [startNodeId, endNodeId];
  const totalDist = distKm.get(endNodeId) !== Infinity ? distKm.get(endNodeId)! : 5.0;
  const totalTime = dist.get(endNodeId) !== Infinity ? dist.get(endNodeId)! : 8.0;

  // Stitch road waypoints together along Dijkstra path
  const fullCoordinates: [number, number][] = [];
  for (let i = 0; i < finalPath.length - 1; i++) {
    const fromId = finalPath[i];
    const toId = finalPath[i + 1];
    const edgeObj = adj.get(fromId)?.find(n => n.to === toId);
    if (edgeObj && edgeObj.waypoints.length > 0) {
      edgeObj.waypoints.forEach((pt, pIdx) => {
        if (i > 0 && pIdx === 0) return;
        fullCoordinates.push(pt);
      });
    } else {
      const fn = nodeMap.get(fromId);
      const tn = nodeMap.get(toId);
      if (fn && i === 0) fullCoordinates.push([fn.lat, fn.lng]);
      if (tn) fullCoordinates.push([tn.lat, tn.lng]);
    }
  }

  const computationTimeMs = Math.round((performance.now() - startTime + 0.38) * 100) / 100;

  return {
    pathNodeIds: finalPath,
    totalDistanceKm: Math.round(totalDist * 10) / 10,
    totalTimeMinutes: Math.round(totalTime * 10) / 10,
    nodesExplored,
    computationTimeMs,
    fullCoordinates
  };
}

// ============================================================================
// 3. KOLHAPUR FLEET SEED VEHICLES (MH-09 REGISTRATION)
// ============================================================================

const KOLHAPUR_VEHICLES: Vehicle[] = [
  {
    id: 'veh_01',
    name: 'Rapid EV Bike Alpha',
    type: 'ev_bike',
    plate: 'MH-09-EV-4091',
    driver: 'Tanaji Patil',
    speedKmH: 48,
    maxSpeedKmH: 55,
    batteryPct: 88,
    tempC: 4.2,
    targetTempC: 4.0,
    cargo: 'Vaccine Cold Box (VCC-001) x 20',
    capacityUnits: 40,
    currentUnits: 20,
    status: 'en_route',
    originId: 'wh_shiroli_midc',
    destinationId: 'store_rajarampuri',
    pathNodeIds: ['wh_shiroli_midc', 'j_tawde_hotel', 'j_kawala_naka', 'store_rajarampuri'],
    currentEdgeIndex: 1,
    progressOnEdge: 0.35,
    totalDistanceKm: 8.2,
    etaMinutes: 9.4,
    dijkstraTimeMs: 0.68,
    color: '#0D9488'
  },
  {
    id: 'veh_02',
    name: 'Reefer EV Van Beta',
    type: 'reefer_van',
    plate: 'MH-09-CD-8821',
    driver: 'Sachin Jadhav',
    speedKmH: 56,
    maxSpeedKmH: 80,
    batteryPct: 79,
    tempC: 3.8,
    targetTempC: 4.0,
    cargo: 'Insulin Glargine (MED-104) x 240',
    capacityUnits: 350,
    currentUnits: 240,
    status: 'en_route',
    originId: 'wh_shiroli_midc',
    destinationId: 'hosp_cpr',
    pathNodeIds: ['wh_shiroli_midc', 'j_tawde_hotel', 'j_kawala_naka', 'j_dabholkar_corner', 'hosp_cpr'],
    currentEdgeIndex: 2,
    progressOnEdge: 0.50,
    totalDistanceKm: 9.5,
    etaMinutes: 10.8,
    dijkstraTimeMs: 0.72,
    color: '#2563EB'
  },
  {
    id: 'veh_03',
    name: 'Autonomous Drone Sky-1',
    type: 'drone',
    plate: 'DRONE-KL-01',
    driver: 'Autonomous AI Flight Control',
    speedKmH: 85,
    maxSpeedKmH: 95,
    batteryPct: 94,
    tempC: 3.5,
    targetTempC: 4.0,
    cargo: 'Emergency Polyvalent Antivenom x 8',
    capacityUnits: 12,
    currentUnits: 8,
    status: 'en_route',
    originId: 'wh_gokul_shirgaon',
    destinationId: 'hosp_aster_aadhar',
    pathNodeIds: ['wh_gokul_shirgaon', 'hosp_aster_aadhar'],
    currentEdgeIndex: 0,
    progressOnEdge: 0.70,
    totalDistanceKm: 6.1,
    etaMinutes: 4.3,
    dijkstraTimeMs: 0.29,
    color: '#059669'
  },
  {
    id: 'veh_04',
    name: 'Heavy Reefer Pallet-X',
    type: 'heavy_truck',
    plate: 'MH-09-TR-9902',
    driver: 'Swapnil Bhosale',
    speedKmH: 64,
    maxSpeedKmH: 85,
    batteryPct: 68,
    tempC: -20.2,
    targetTempC: -20.0,
    cargo: 'Comirnaty Ultra-Cold Vials x 1,800',
    capacityUnits: 2500,
    currentUnits: 1800,
    status: 'en_route',
    originId: 'wh_kagal_midc',
    destinationId: 'wh_shiroli_midc',
    pathNodeIds: ['wh_kagal_midc', 'wh_gokul_shirgaon', 'store_uchgaon', 'j_gandhinagar', 'j_kawala_naka', 'j_tawde_hotel', 'wh_shiroli_midc'],
    currentEdgeIndex: 3,
    progressOnEdge: 0.45,
    totalDistanceKm: 27.9,
    etaMinutes: 24.1,
    dijkstraTimeMs: 0.84,
    color: '#D97706'
  }
];

// ============================================================================
// 4. MAIN COMPONENT (KOLHAPUR SIMULATION STUDIO)
// ============================================================================

export const FleetSimulationPage: React.FC = () => {
  const { addToast } = useAppStore();

  // Core Page Mode: 'fleet' (Overview) vs 'interactive_ab' (Mark A and B on map)
  const [activeSimulationMode, setActiveSimulationMode] = useState<'fleet' | 'interactive_ab'>('interactive_ab');

  // Core State for Fleet
  const [nodes] = useState<MapNode[]>(KOLHAPUR_NODES);
  const [edges, setEdges] = useState<MapEdge[]>(KOLHAPUR_EDGES);
  const [vehicles, setVehicles] = useState<Vehicle[]>(KOLHAPUR_VEHICLES);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('veh_01');
  const [selectedVehicleTypeFilter, setSelectedVehicleTypeFilter] = useState<string>('all');
  const [mapTileStyle, setMapTileStyle] = useState<'google_streets' | 'google_hybrid' | 'voyager'>('google_streets');
  const [followSelectedVehicle, setFollowSelectedVehicle] = useState<boolean>(false);
  const [newDispatchModalOpen, setNewDispatchModalOpen] = useState<boolean>(false);

  // Audio state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // ============================================================================
  // INTERACTIVE POINT A ➔ POINT B ROUTING & CAR SIMULATION STATE
  // ============================================================================
  const [markingStep, setMarkingStep] = useState<'idle' | 'mark_a' | 'mark_b'>('idle');
  const [pointA, setPointA] = useState<RoutePoint>({
    lat: 16.7410,
    lng: 74.2750,
    name: 'Shiroli MIDC Logistics Hub',
    address: 'NH-48 Industrial Corridor',
    type: 'warehouse'
  });
  const [pointB, setPointB] = useState<RoutePoint>({
    lat: 16.6945,
    lng: 74.2250,
    name: 'CPR Trauma Hospital',
    address: 'Bhausingji Road, Dasara Chowk',
    type: 'hospital'
  });

  const [activeRoutePlan, setActiveRoutePlan] = useState<RoutePlanResult | null>(null);
  const [isComputingRoute, setIsComputingRoute] = useState<boolean>(false);
  const [selectedCarModel, setSelectedCarModel] = useState<'biocar' | 'reefer_van' | 'ev_bike' | 'heavy_truck'>('biocar');

  // Live Car Simulation Runtime Parameters
  const [carSimRunning, setCarSimRunning] = useState<boolean>(false);
  const [carCoords, setCarCoords] = useState<[number, number]>([16.7410, 74.2750]);
  const [carHeadingDeg, setCarHeadingDeg] = useState<number>(180);
  const [carSpeedKmH, setCarSpeedKmH] = useState<number>(0);
  const [carProgressIdx, setCarProgressIdx] = useState<number>(0); // index along coordinates array
  const [carSubProgress, setCarSubProgress] = useState<number>(0); // 0 to 1 between idx and idx+1
  const [elapsedSimulationSec, setElapsedSimulationSec] = useState<number>(0);
  const [traveledKm, setTraveledKm] = useState<number>(0);
  const [currentInstruction, setCurrentInstruction] = useState<string>('Ready to Depart');
  const [cargoTempC, setCargoTempC] = useState<number>(3.8);
  const [batteryLevel, setBatteryLevel] = useState<number>(98.5);

  // Trip Arrival Modal
  const [arrivalReportOpen, setArrivalReportOpen] = useState<boolean>(false);

  // New Dispatch Form State
  const [dispatchOrigin, setDispatchOrigin] = useState<string>('wh_shiroli_midc');
  const [dispatchDest, setDispatchDest] = useState<string>('hosp_cpr');
  const [dispatchVehType, setDispatchVehType] = useState<Vehicle['type']>('reefer_van');
  const [dispatchCargo, setDispatchCargo] = useState<string>('Antibiotics Pack (DRG-778) x 150');

  // DOM & Leaflet Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const nodeMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const dijkstraRouteGlowRef = useRef<L.Polyline | null>(null);

  // Point A & B Interactive Markers
  const pointAMarkerRef = useRef<L.Marker | null>(null);
  const pointBMarkerRef = useRef<L.Marker | null>(null);
  const customRouteLineRef = useRef<L.Polyline | null>(null);
  const traversedRouteLineRef = useRef<L.Polyline | null>(null);
  const customCarMarkerRef = useRef<L.Marker | null>(null);

  const animationRef = useRef<number | null>(null);
  const lastTickTime = useRef<number>(Date.now());
  const lastTurnChimeTime = useRef<number>(0);
  const currentDistanceRef = useRef<number>(0);
  const lastBearingRef = useRef<number>(180);
  const lastTurnSoundTimeRef = useRef<number>(0);
  const lastTelemetryUpdateTimeRef = useRef<number>(0);

  // Pre-calculate cumulative distance along route coordinates for instant O(1) interpolation
  const cumulativeDistances = useMemo(() => {
    if (!activeRoutePlan || activeRoutePlan.coordinates.length < 2) return [];
    const coords = activeRoutePlan.coordinates;
    const dists: number[] = [0];
    let acc = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const d = getDistanceKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
      acc += d;
      dists.push(acc);
    }
    return dists;
  }, [activeRoutePlan]);

  // Quick lookup
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Selected Vehicle Object
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  }, [vehicles, selectedVehicleId]);

  // Dijkstra Solution for Selected Vehicle
  const selectedDijkstraResult = useMemo(() => {
    if (!selectedVehicle) return null;
    return runDijkstraAlgorithm(
      selectedVehicle.originId, 
      selectedVehicle.destinationId, 
      edges, 
      nodes, 
      selectedVehicle.type
    );
  }, [selectedVehicle, edges, nodes]);

  // Tile URL definitions
  const tileConfig = useMemo(() => ({
    google_streets: {
      url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      name: 'Google Streets',
      attribution: '&copy; Google Maps'
    },
    google_hybrid: {
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      name: 'Google Satellite Hybrid',
      attribution: '&copy; Google Earth Imagery'
    },
    voyager: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      name: 'Enterprise Clean GIS',
      attribution: '&copy; OpenStreetMap & CARTO'
    }
  }), []);

  // --------------------------------------------------------------------------
  // AUDIO TOGGLE HANDLER
  // --------------------------------------------------------------------------
  const handleToggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    soundEffects.setMuted(!nextState);
    if (!nextState) {
      soundEffects.stopEngineHum();
    }
    addToast({
      type: 'info',
      title: nextState ? 'Sound Effects Enabled' : 'Sound Effects Muted',
      message: nextState ? 'Engine hum, turn chimes, and route fanfares active.' : 'Audio muted.'
    });
  };

  // --------------------------------------------------------------------------
  // INITIALIZE REAL LEAFLET MAP CENTERED ON KOLHAPUR
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Kolhapur Metropolis
    const map = L.map(mapContainerRef.current, {
      center: [16.6980, 74.2400],
      zoom: 13,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial Tile Layer
    const tileL = L.tileLayer(tileConfig[mapTileStyle].url, {
      attribution: tileConfig[mapTileStyle].attribution,
      maxZoom: 19
    }).addTo(map);

    tileLayerRef.current = tileL;

    // Feature Layers
    routesLayerRef.current = L.layerGroup().addTo(map);
    nodeMarkersLayerRef.current = L.layerGroup().addTo(map);

    // Fit Kolhapur Bounds
    const bounds = L.latLngBounds(KOLHAPUR_NODES.map(n => [n.lat, n.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [tileConfig, mapTileStyle]);

  // Update Tile Layer Style
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(tileConfig[mapTileStyle].url);
  }, [mapTileStyle, tileConfig]);

  // --------------------------------------------------------------------------
  // MAP CLICK LISTENER FOR MARKING POINT A AND POINT B
  // --------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const nearest = findNearestKolhapurNode(lat, lng);
      const clickedName = nearest ? `Near ${nearest.name.split(' (')[0]}` : `Kolhapur Coord (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

      if (markingStep === 'mark_a') {
        const newA: RoutePoint = {
          lat,
          lng,
          name: clickedName,
          address: 'Marked on Kolhapur Real Map',
          type: 'custom'
        };
        setPointA(newA);
        setCarCoords([lat, lng]);
        soundEffects.playPinDrop();
        setMarkingStep('mark_b');
        addToast({
          type: 'info',
          title: 'Start Point [A] Set',
          message: `${clickedName}. Now click on the map to set Destination Point [B].`
        });
      } else if (markingStep === 'mark_b') {
        const newB: RoutePoint = {
          lat,
          lng,
          name: clickedName,
          address: 'Marked on Kolhapur Real Map',
          type: 'custom'
        };
        setPointB(newB);
        soundEffects.playPinDrop();
        setMarkingStep('idle');
        addToast({
          type: 'success',
          title: 'Destination Point [B] Set',
          message: `${clickedName}. Computing shortest road directions...`
        });
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [markingStep, addToast]);

  const findNearestKolhapurNode = (lat: number, lng: number): MapNode | null => {
    let nearest: MapNode | null = null;
    let minDist = Infinity;
    nodes.forEach(n => {
      const d = getDistanceKm(lat, lng, n.lat, n.lng);
      if (d < minDist && d < 1.8) {
        minDist = d;
        nearest = n;
      }
    });
    return nearest;
  };

  // --------------------------------------------------------------------------
  // RECOMPUTE SHORTEST ROAD DIRECTIONS FOR POINT A & POINT B
  // --------------------------------------------------------------------------
  const calculateRouteBetweenAB = useCallback(async (startPt: RoutePoint, endPt: RoutePoint) => {
    setIsComputingRoute(true);

    // Fallback graph routing using nearest graph nodes
    const graphFallbackFn = (): [number, number][] => {
      let nA = nodes[0];
      let nB = nodes[1];
      let minA = Infinity;
      let minB = Infinity;

      nodes.forEach(n => {
        const dA = getDistanceKm(startPt.lat, startPt.lng, n.lat, n.lng);
        const dB = getDistanceKm(endPt.lat, endPt.lng, n.lat, n.lng);
        if (dA < minA) { minA = dA; nA = n; }
        if (dB < minB) { minB = dB; nB = n; }
      });

      const res = runDijkstraAlgorithm(nA.id, nB.id, edges, nodes, 'reefer_van');
      return [[startPt.lat, startPt.lng], ...res.fullCoordinates, [endPt.lat, endPt.lng]];
    };

    const routeResult = await computeRoadRoute(startPt, endPt, graphFallbackFn);
    setActiveRoutePlan(routeResult);
    setIsComputingRoute(false);

    if (routeResult.coordinates.length > 0) {
      setCarCoords(routeResult.coordinates[0]);
      if (routeResult.coordinates.length > 1) {
        const bearing = calculateBearing(
          routeResult.coordinates[0][0],
          routeResult.coordinates[0][1],
          routeResult.coordinates[1][0],
          routeResult.coordinates[1][1]
        );
        setCarHeadingDeg(bearing);
      }
    }

    currentDistanceRef.current = 0;
    if (traversedRouteLineRef.current) {
      traversedRouteLineRef.current.setLatLngs([]);
    }
    setCarProgressIdx(0);
    setCarSubProgress(0);
    setTraveledKm(0);
    setElapsedSimulationSec(0);
    setBatteryLevel(98.5);
    setCargoTempC(3.8);

    soundEffects.playRouteFound();

    // Fit map bounds to encompass Point A, Point B, and the route
    if (mapInstanceRef.current && routeResult.coordinates.length > 0) {
      const bounds = L.latLngBounds(routeResult.coordinates);
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }

    addToast({
      type: 'success',
      title: 'Shortest Route Computed',
      message: `${routeResult.distanceKm} km in ~${routeResult.estimatedMinutes} min. Dijkstra shortest road directions active.`
    });
  }, [edges, nodes, addToast]);

  // Re-run route calculation whenever Point A or Point B changes
  useEffect(() => {
    calculateRouteBetweenAB(pointA, pointB);
  }, [pointA, pointB, calculateRouteBetweenAB]);

  // --------------------------------------------------------------------------
  // RENDER POINT A, POINT B, AND GLOWING LASER ROAD POLYLINE
  // --------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Render Point A Marker (Emerald Green Radar Beacon)
    if (pointAMarkerRef.current) {
      pointAMarkerRef.current.remove();
      pointAMarkerRef.current = null;
    }

    const iconA = L.divIcon({
      className: 'custom-beacon-a',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(13, 148, 136, 0.35);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: #0D9488;
            border: 2.5px solid #FFFFFF;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 13px;
            box-shadow: 0 4px 14px rgba(13,148,136,0.5);
            position: relative;
            z-index: 10;
          ">
            A
          </div>
          <div style="
            position: absolute;
            bottom: -22px;
            background: #102A43;
            color: #FFFFFF;
            font-size: 9px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
          ">
            START: ${pointA.name.split(' (')[0]}
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    pointAMarkerRef.current = L.marker([pointA.lat, pointA.lng], { icon: iconA }).addTo(map);

    // 2. Render Point B Marker (Ruby Red Target Beacon)
    if (pointBMarkerRef.current) {
      pointBMarkerRef.current.remove();
      pointBMarkerRef.current = null;
    }

    const iconB = L.divIcon({
      className: 'custom-beacon-b',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: rgba(220, 38, 38, 0.35);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: #DC2626;
            border: 2.5px solid #FFFFFF;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 13px;
            box-shadow: 0 4px 14px rgba(220,38,38,0.5);
            position: relative;
            z-index: 10;
          ">
            B
          </div>
          <div style="
            position: absolute;
            bottom: -22px;
            background: #102A43;
            color: #FFFFFF;
            font-size: 9px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 4px;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
          ">
            DEST: ${pointB.name.split(' (')[0]}
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    pointBMarkerRef.current = L.marker([pointB.lat, pointB.lng], { icon: iconB }).addTo(map);    // 3. Render High-Tech Laser Shortest Path Polyline & Traversed Energy Conduit
    if (customRouteLineRef.current) {
      customRouteLineRef.current.remove();
      customRouteLineRef.current = null;
    }
    if (traversedRouteLineRef.current) {
      traversedRouteLineRef.current.remove();
      traversedRouteLineRef.current = null;
    }

    if (activeRoutePlan && activeRoutePlan.coordinates.length > 1) {
      // Background glow polyline (outer sky halo)
      const glowLine = L.polyline(activeRoutePlan.coordinates, {
        color: '#0284C7',
        weight: 9,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Ahead guidance route (translucent pulsing dashed line)
      const coreLine = L.polyline(activeRoutePlan.coordinates, {
        color: '#38BDF8',
        weight: 4,
        opacity: 0.75,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '8, 12'
      }).addTo(map);

      customRouteLineRef.current = L.layerGroup([glowLine, coreLine]).addTo(map) as unknown as L.Polyline;

      // Traversed Active Polyline (vibrant glowing neon mint/teal energy trail)
      traversedRouteLineRef.current = L.polyline([], {
        color: '#00F5D4',
        weight: 6,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }
  }, [pointA, pointB, activeRoutePlan]);

  // --------------------------------------------------------------------------
  // CAR SIMULATION RUNTIME LOOP (FAST DISTANCE INTERPOLATION, BEARING, SOUND)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!carSimRunning || !activeRoutePlan || activeRoutePlan.coordinates.length < 2 || cumulativeDistances.length < 2) {
      soundEffects.stopEngineHum();
      return;
    }

    soundEffects.startEngineHum(carSpeedKmH || 55);

    const coords = activeRoutePlan.coordinates;
    const totalDistKm = cumulativeDistances[cumulativeDistances.length - 1] || activeRoutePlan.distanceKm || 1;
    // Fast paced: standard 1x takes ~10.0 seconds for the entire route
    const targetBaseDurationSec = 10.0;
    const travelRateKmPerSec = (totalDistKm / targetBaseDurationSec) * simSpeed;

    lastTickTime.current = performance.now();
    lastTurnSoundTimeRef.current = 0;
    lastTelemetryUpdateTimeRef.current = 0;

    const tick = (now: number) => {
      const deltaSec = Math.min(0.08, (now - lastTickTime.current) / 1000);
      lastTickTime.current = now;

      // Advance cumulative distance
      currentDistanceRef.current += travelRateKmPerSec * deltaSec;

      if (currentDistanceRef.current >= totalDistKm) {
        // Destination Reached!
        currentDistanceRef.current = totalDistKm;
        const endPt = coords[coords.length - 1];
        setCarCoords(endPt);
        setTraveledKm(Math.round(totalDistKm * 10) / 10);
        setCarSimRunning(false);
        soundEffects.stopEngineHum();
        soundEffects.playArrivalFanfare();
        setArrivalReportOpen(true);

        // Update traversed polyline to full path
        if (traversedRouteLineRef.current) {
          traversedRouteLineRef.current.setLatLngs(coords);
        }

        // Smoothly zoom out map to show all Kolhapur facilities & warehouses!
        if (mapInstanceRef.current) {
          const allBounds = L.latLngBounds(KOLHAPUR_NODES.map(n => [n.lat, n.lng]));
          mapInstanceRef.current.flyToBounds(allBounds, { padding: [55, 55], duration: 1.2 });
        }
        return;
      }

      // Find current segment along cumulative distances
      let segIdx = 0;
      while (
        segIdx < cumulativeDistances.length - 2 &&
        cumulativeDistances[segIdx + 1] < currentDistanceRef.current
      ) {
        segIdx++;
      }

      const p1 = coords[segIdx];
      const p2 = coords[segIdx + 1];
      const d1 = cumulativeDistances[segIdx];
      const d2 = cumulativeDistances[segIdx + 1];
      const span = Math.max(0.000001, d2 - d1);
      const t = Math.max(0, Math.min(1, (currentDistanceRef.current - d1) / span));

      const curLat = p1[0] + (p2[0] - p1[0]) * t;
      const curLng = p1[1] + (p2[1] - p1[1]) * t;
      const curBearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);

      // Turn chime sound on noticeable road curve
      const bearingDiff = Math.abs(curBearing - lastBearingRef.current);
      if ((bearingDiff > 25 && bearingDiff < 335) && (now - lastTurnSoundTimeRef.current > 1400)) {
        soundEffects.playTurnChime();
        lastTurnSoundTimeRef.current = now;
      }
      lastBearingRef.current = curBearing;

      // Real-time direct Leaflet updates (60fps silky smooth with zero React lag)
      if (traversedRouteLineRef.current) {
        const traversed = coords.slice(0, segIdx + 1).concat([[curLat, curLng]]);
        traversedRouteLineRef.current.setLatLngs(traversed);
      }

      if (customCarMarkerRef.current) {
        customCarMarkerRef.current.setLatLng([curLat, curLng]);
        const el = customCarMarkerRef.current.getElement();
        if (el) {
          const rotEl = el.querySelector('.car-rotator') as HTMLElement;
          if (rotEl) {
            rotEl.style.transform = `rotate(${curBearing}deg)`;
          }
          const counterEl = el.querySelector('.speed-counter-rot') as HTMLElement;
          if (counterEl) {
            counterEl.style.transform = `translateX(-50%) rotate(-${curBearing}deg)`;
          }
        }
      }

      if (followSelectedVehicle && mapInstanceRef.current) {
        mapInstanceRef.current.panTo([curLat, curLng], { animate: false });
      }

      // Throttled React state updates for HUD (every 80ms)
      if (now - lastTelemetryUpdateTimeRef.current > 80) {
        lastTelemetryUpdateTimeRef.current = now;
        const frac = totalDistKm > 0 ? currentDistanceRef.current / totalDistKm : 0;
        const displaySpeed = Math.round(52 + (simSpeed - 1) * 22 + Math.sin(now / 350) * 8);
        setCarSpeedKmH(displaySpeed);
        soundEffects.updateEngineHum(displaySpeed);
        setTraveledKm(Math.round(currentDistanceRef.current * 10) / 10);
        setCarCoords([curLat, curLng]);
        setCarHeadingDeg(curBearing);
        setElapsedSimulationSec(sec => sec + deltaSec);
        setBatteryLevel(b => Math.max(10, Math.round((98.5 - frac * 12) * 10) / 10));
        setCargoTempC(3.8 + (Math.sin(now / 2000) * 0.15));

        const stepIdx = Math.min(
          Math.floor(frac * activeRoutePlan.steps.length),
          activeRoutePlan.steps.length - 1
        );
        if (activeRoutePlan.steps[stepIdx]) {
          setCurrentInstruction(activeRoutePlan.steps[stepIdx].instruction);
        }
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      soundEffects.stopEngineHum();
    };
  }, [carSimRunning, activeRoutePlan, cumulativeDistances, simSpeed, followSelectedVehicle]);

  // --------------------------------------------------------------------------
  // RENDER DEDICATED CYBERPOD VEHICLE WITH HEADLIGHT BEAMS & ION THRUSTER
  // --------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (customCarMarkerRef.current) {
      customCarMarkerRef.current.remove();
      customCarMarkerRef.current = null;
    }

    const isCar = selectedCarModel === 'biocar';
    const isVan = selectedCarModel === 'reefer_van';
    const isTruck = selectedCarModel === 'heavy_truck';
    const vehColor = isCar ? '#00F5D4' : isVan ? '#38BDF8' : isTruck ? '#F59E0B' : '#10B981';

    const carHtml = `
      <div class="car-rotator" style="
        position: relative;
        width: 68px;
        height: 68px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${carHeadingDeg}deg);
        transform-origin: center center;
        will-change: transform;
      ">
        <!-- Dual Laser Headlights Beam with Forward Conic Projection -->
        <div style="
          position: absolute;
          top: -48px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 26px solid transparent;
          border-right: 26px solid transparent;
          border-top: 56px solid rgba(0, 245, 212, 0.45);
          filter: drop-shadow(0 0 10px rgba(0, 245, 212, 0.65)) blur(2px);
          pointer-events: none;
          z-index: 1;
        "></div>

        <!-- Animated Ion Thruster Plume at Rear -->
        <div style="
          position: absolute;
          bottom: -12px;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 20px;
          background: radial-gradient(circle, #00F5D4 0%, rgba(13, 148, 136, 0.7) 45%, transparent 80%);
          border-radius: 50%;
          filter: blur(1.5px);
          animation: pulse 0.7s infinite alternate;
          pointer-events: none;
          z-index: 2;
        "></div>

        <!-- CyberPod Aerodynamic Armored Chassis -->
        <div style="
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0B192C 0%, #1E293B 100%);
          border: 2px solid ${vehColor};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(0, 245, 212, 0.4), inset 0 0 10px rgba(0, 245, 212, 0.2);
          position: relative;
          z-index: 10;
        ">
          <!-- Directional Arrowhead Visor -->
          <div style="
            position: absolute;
            top: 4px;
            width: 10px;
            height: 3px;
            background: ${vehColor};
            border-radius: 2px;
            box-shadow: 0 0 8px ${vehColor};
          "></div>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${vehColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            ${isCar ? `
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3C2.1 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <circle cx="17" cy="17" r="2"/>
            ` : isTruck ? `
              <rect x="1" y="3" width="15" height="13"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            ` : `
              <rect x="1" y="3" width="15" height="13"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            `}
          </svg>
        </div>

        <!-- Overhead Floating Speed Telemetry Pill (Counter-rotated) -->
        <div class="speed-counter-rot" style="
          position: absolute;
          top: -22px;
          left: 50%;
          transform: translateX(-50%) rotate(-${carHeadingDeg}deg);
          background: #0F172A;
          color: #00F5D4;
          border: 1px solid rgba(0, 245, 212, 0.6);
          font-size: 8px;
          font-weight: 800;
          font-family: monospace;
          padding: 1px 6px;
          border-radius: 9999px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          z-index: 25;
          pointer-events: none;
        ">
          ⚡ ${carSpeedKmH || 60} km/h
        </div>
      </div>
    `;

    const carIcon = L.divIcon({
      className: 'custom-car-animated-marker',
      html: carHtml,
      iconSize: [68, 68],
      iconAnchor: [34, 34]
    });

    customCarMarkerRef.current = L.marker(carCoords, { icon: carIcon, zIndexOffset: 2000 }).addTo(map);

    if (followSelectedVehicle) {
      map.panTo(carCoords, { animate: false });
    }
  }, [selectedCarModel]);

  // --------------------------------------------------------------------------
  // USER ACTIONS: START CAR TRIP & RESET
  // --------------------------------------------------------------------------
  const handleStartCarTrip = () => {
    if (!activeRoutePlan || activeRoutePlan.coordinates.length < 2) {
      addToast({
        type: 'error',
        title: 'Route Required',
        message: 'Please set Point A and Point B on the map first.'
      });
      return;
    }

    const totalDistKm = cumulativeDistances[cumulativeDistances.length - 1] || activeRoutePlan.distanceKm || 1;
    if (currentDistanceRef.current >= totalDistKm - 0.05) {
      // Re-starting after completed trip
      currentDistanceRef.current = 0;
      if (traversedRouteLineRef.current) {
        traversedRouteLineRef.current.setLatLngs([]);
      }
      setTraveledKm(0);
      setElapsedSimulationSec(0);
      setArrivalReportOpen(false);
    }

    setCarSimRunning(true);
    soundEffects.playEngineStart();
    addToast({
      type: 'info',
      title: 'High-Tech Transport Active',
      message: `Navigating Kolhapur corridor from ${pointA.name} to ${pointB.name}.`
    });
  };

  const handlePauseCarTrip = () => {
    setCarSimRunning(false);
    soundEffects.stopEngineHum();
    addToast({
      type: 'info',
      title: 'Simulation Paused',
      message: 'Vehicle movement temporarily held.'
    });
  };

  const handleResetCarTrip = () => {
    setCarSimRunning(false);
    soundEffects.stopEngineHum();
    currentDistanceRef.current = 0;
    if (traversedRouteLineRef.current) {
      traversedRouteLineRef.current.setLatLngs([]);
    }
    if (activeRoutePlan && activeRoutePlan.coordinates.length > 0) {
      const startPos = activeRoutePlan.coordinates[0];
      setCarCoords(startPos);
      if (customCarMarkerRef.current) {
        customCarMarkerRef.current.setLatLng(startPos);
      }
    }
    setCarProgressIdx(0);
    setCarSubProgress(0);
    setTraveledKm(0);
    setElapsedSimulationSec(0);
    setCarSpeedKmH(0);
    setBatteryLevel(98.5);
    setArrivalReportOpen(false);
    addToast({
      type: 'info',
      title: 'Trip Reset',
      message: 'Transport returned to Start Point [A]. All Kolhapur points ready.'
    });
  };

  // Quick Preset Handlers
  const handleSelectPresetRoute = (originNodeId: string, destNodeId: string) => {
    const oNode = nodeMap.get(originNodeId);
    const dNode = nodeMap.get(destNodeId);
    if (!oNode || !dNode) return;

    setCarSimRunning(false);
    soundEffects.stopEngineHum();

    setPointA({
      lat: oNode.lat,
      lng: oNode.lng,
      name: oNode.name,
      address: oNode.address,
      type: oNode.type
    });
    setPointB({
      lat: dNode.lat,
      lng: dNode.lng,
      name: dNode.name,
      address: dNode.address,
      type: dNode.type
    });
  };

  // Export trip waybill
  const handleExportTripManifest = () => {
    try {
      downloadWaybillPdf({
        transfer_id: `TRF-KL-${Date.now().toString().slice(-4)}`,
        transfer_number: `KL-EXP-${Date.now().toString().slice(-6)}`,
        source_warehouse_id: pointA.name,
        target_warehouse_id: pointB.name,
        status: 'delivered',
        created_at: new Date().toISOString(),
        requested_by: 'Kolhapur Central Dispatch',
        items: [
          { product_id: 'prd_vax_01', sku: 'VCC-001', quantity: 240 },
          { product_id: 'prd_ins_02', sku: 'INS-404', quantity: 180 }
        ],
        recipient_name: 'Receiving Medical Officer, Kolhapur',
        cold_chain_temp: `${cargoTempC.toFixed(1)} °C [Compliant 2°C - 8°C]`,
        carrier_notes: `Dijkstra Shortest Path Transport completed. Total Distance: ${activeRoutePlan?.distanceKm || 0} km. Elapsed Real Time: ${Math.round(elapsedSimulationSec)}s.`
      });
      addToast({
        type: 'success',
        title: 'Trip Manifest Downloaded',
        message: 'Digital Proof of Delivery and thermal log exported to PDF.'
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  // --------------------------------------------------------------------------
  // RENDER ROAD NETWORK EDGES & KOLHAPUR HUBS / CLINICS
  // --------------------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !routesLayerRef.current || !nodeMarkersLayerRef.current) return;

    routesLayerRef.current.clearLayers();
    nodeMarkersLayerRef.current.clearLayers();

    // 1. Draw Road Network Polylines
    edges.forEach((edge) => {
      let color = '#94A3B8';
      let weight = 2.5;
      let opacity = 0.5;

      if (edge.trafficFactor > 2.0) {
        color = '#DC2626';
        weight = 4.0;
        opacity = 0.8;
      } else if (edge.roadType === 'expressway') {
        color = '#64748B';
        weight = 3.5;
        opacity = 0.6;
      }

      const poly = L.polyline(edge.waypoints, {
        color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round'
      });

      routesLayerRef.current?.addLayer(poly);
    });

    // 2. Draw Facility Nodes in Kolhapur
    nodes.forEach((node) => {
      let iconColor = '#0D9488';
      let iconBg = '#F0FDFA';
      let symbol = 'WH';

      if (node.type === 'hospital') {
        iconColor = '#DC2626';
        iconBg = '#FEF2F2';
        symbol = '✚';
      } else if (node.type === 'darkstore') {
        iconColor = '#7C3AED';
        iconBg = '#F5F3FF';
        symbol = '⚡';
      } else if (node.type === 'junction') {
        iconColor = '#2563EB';
        iconBg = '#EFF6FF';
        symbol = '•';
      }

      const customDivIcon = L.divIcon({
        className: 'custom-facility-pin',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              width: 36px;
              height: 36px;
              border-radius: 10px;
              background: ${iconColor}28;
              animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              background: ${iconBg};
              border: 2px solid ${iconColor};
              color: ${iconColor};
              width: 28px;
              height: 28px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 800;
              font-size: 11px;
              box-shadow: 0 4px 12px rgba(16,42,67,0.3);
              cursor: pointer;
              position: relative;
              z-index: 10;
              transition: transform 0.15s ease-out;
            ">
              <span>${symbol}</span>
            </div>
            <div style="
              position: absolute;
              bottom: -18px;
              left: 50%;
              transform: translateX(-50%);
              background: #0F172A;
              color: white;
              font-size: 8.5px;
              font-weight: 800;
              padding: 1px 6px;
              border-radius: 4px;
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              border: 1px solid rgba(255,255,255,0.15);
              z-index: 12;
            ">
              ${node.name.split(' (')[0]}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([node.lat, node.lng], { icon: customDivIcon, zIndexOffset: 1500 });
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px;">
          <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: bold;">
            ${node.type.toUpperCase()} • KOLHAPUR REGION
          </span>
          <h4 style="margin: 2px 0 4px; color: #102A43; font-weight: bold;">${node.name}</h4>
          <p style="margin: 0; color: #64748B; font-size: 11px;">${node.address}</p>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button 
              id="btn-set-a-${node.id}" 
              style="background: #0D9488; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 10px; cursor: pointer;"
            >
              Set as Point A
            </button>
            <button 
              id="btn-set-b-${node.id}" 
              style="background: #DC2626; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 10px; cursor: pointer;"
            >
              Set as Point B
            </button>
          </div>
        </div>
      `);

      marker.on('popupopen', () => {
        const btnA = document.getElementById(`btn-set-a-${node.id}`);
        const btnB = document.getElementById(`btn-set-b-${node.id}`);
        if (btnA) {
          btnA.onclick = () => {
            setPointA({ lat: node.lat, lng: node.lng, name: node.name, address: node.address, type: node.type });
            soundEffects.playPinDrop();
            addToast({ type: 'info', title: 'Start Point [A] Set', message: node.name });
          };
        }
        if (btnB) {
          btnB.onclick = () => {
            setPointB({ lat: node.lat, lng: node.lng, name: node.name, address: node.address, type: node.type });
            soundEffects.playPinDrop();
            addToast({ type: 'info', title: 'Destination Point [B] Set', message: node.name });
          };
        }
      });

      nodeMarkersLayerRef.current?.addLayer(marker);
    });
  }, [edges, nodes, addToast]);

  // Format Elapsed Time MM:SS
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER                                                            */}
      {/* ========================================================================= */}
      <PageHeader
        category="Kolhapur Region Operations & Interactive Road Routing"
        title="Interactive Point A ➔ B Shortest Path & Car Transport Simulator"
        subtitle="Mark Start [A] and End [B] directly on the Kolhapur map to detect the optimal road route with live vehicle physics, speed telemetry, and audio effects."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSound}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
              title="Toggle Web Audio engine sound effects"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>Audio FX: ON</span>
                  <span className="flex gap-0.5 items-end h-3 ml-1">
                    <span className="w-0.5 h-2 bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 h-3 bg-emerald-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-0.5 h-1.5 bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span>Audio: Muted</span>
                </>
              )}
            </button>

            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={handleResetCarTrip}
            >
              Reset Trip
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={FileText}
              onClick={handleExportTripManifest}
            >
              Export Waybill PDF
            </Button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* 2. TOP METRIC CARDS                                                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Trip Distance (Point A ➔ B)"
          value={`${activeRoutePlan?.distanceKm || 0} km`}
          change="Street-level road routing"
          secondaryLabel={`${traveledKm.toFixed(1)} km traversed`}
          icon={Navigation}
          iconBg="bg-[#F0FDFA] border-[#CCFBF1]"
          iconColor="text-[#0D9488]"
          sparklineColor="teal"
        />

        <KPICard
          title="Elapsed Transport Stopwatch"
          value={formatTime(elapsedSimulationSec)}
          change={`Road ETA: ~${activeRoutePlan?.estimatedMinutes || 0} min`}
          secondaryLabel="Real-time chronometer"
          icon={Timer}
          iconBg="bg-blue-50 border-blue-200"
          iconColor="text-[#2563EB]"
          sparklineColor="blue"
        />

        <KPICard
          title="Live Speed & Heading"
          value={`${carSpeedKmH} km/h`}
          change={`${Math.round(carHeadingDeg)}° Compass Bearing`}
          secondaryLabel="Dynamic acceleration"
          icon={Gauge}
          iconBg="bg-purple-50 border-purple-200"
          iconColor="text-purple-700"
          sparklineColor="green"
        />

        <KPICard
          title="Cold-Chain Payload Temp"
          value={`${cargoTempC.toFixed(1)} °C`}
          change="100% Compliant (2-8°C)"
          secondaryLabel="Bio-Reefer Active"
          icon={ThermometerSnowflake}
          iconBg="bg-emerald-50 border-emerald-200"
          iconColor="text-[#059669]"
          sparklineColor="teal"
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE POINT A ➔ POINT B CONTROL BAR                               */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Point A & Point B Selectors / Markers */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Start Point A */}
            <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1]">
              <div className="w-6 h-6 rounded-lg bg-[#0D9488] text-white flex items-center justify-center font-bold text-xs shrink-0">
                A
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[#0D9488]">Start Point (Origin)</div>
                <div className="text-xs font-bold text-[#102A43] truncate max-w-[180px]" title={pointA.name}>
                  {pointA.name}
                </div>
              </div>
              <button
                onClick={() => {
                  setMarkingStep('mark_a');
                  addToast({ type: 'info', title: 'Click on Map', message: 'Click anywhere on the map to place Point A.' });
                }}
                className={`ml-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                  markingStep === 'mark_a'
                    ? 'bg-[#0D9488] text-white animate-pulse'
                    : 'bg-white border border-[#0D9488]/30 text-[#0D9488] hover:bg-[#0D9488] hover:text-white'
                }`}
              >
                {markingStep === 'mark_a' ? 'Click Map...' : 'Change Pin A'}
              </button>
            </div>

            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />

            {/* Destination Point B */}
            <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl bg-red-50 border border-red-200">
              <div className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                B
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-red-600">Destination (End)</div>
                <div className="text-xs font-bold text-[#102A43] truncate max-w-[180px]" title={pointB.name}>
                  {pointB.name}
                </div>
              </div>
              <button
                onClick={() => {
                  setMarkingStep('mark_b');
                  addToast({ type: 'info', title: 'Click on Map', message: 'Click destination point on the map to place Point B.' });
                }}
                className={`ml-1 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                  markingStep === 'mark_b'
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-white border border-red-300 text-red-600 hover:bg-red-600 hover:text-white'
                }`}
              >
                {markingStep === 'mark_b' ? 'Click Map...' : 'Change Pin B'}
              </button>
            </div>

            {/* Vehicle Model Picker */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
              <span className="text-[10px] font-semibold text-[#64748B] px-1.5">Vehicle:</span>
              {[
                { id: 'biocar', label: 'EV BioCar', icon: Car },
                { id: 'reefer_van', label: 'Reefer Van', icon: Truck },
                { id: 'ev_bike', label: 'Rapid Bike', icon: Bike },
                { id: 'heavy_truck', label: 'Heavy Truck', icon: Truck },
              ].map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedCarModel(v.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    selectedCarModel === v.id
                      ? 'bg-[#102A43] text-white shadow-2xs'
                      : 'text-[#64748B] hover:text-[#172B3A]'
                  }`}
                >
                  <v.icon className="w-3 h-3" />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Primary Play / Pause / Replay Controls */}
          <div className="flex items-center gap-2">
            {!carSimRunning ? (
              <button
                onClick={handleStartCarTrip}
                className="px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Simulate Car Journey</span>
              </button>
            ) : (
              <button
                onClick={handlePauseCarTrip}
                className="px-5 py-2.5 rounded-xl bg-[#102A43] hover:bg-[#17324D] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                <Pause className="w-4 h-4" />
                <span>Pause Transport</span>
              </button>
            )}

            {/* Speed Multipliers */}
            <div className="flex items-center p-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs gap-1">
              {[
                { s: 1, label: '1x Fast (~10s)' },
                { s: 2, label: '2x Turbo (~5s)' },
                { s: 4, label: '4x Hyper (~2.5s)' },
                { s: 8, label: '8x Warp (~1.2s)' },
              ].map(({ s, label }) => (
                <button
                  key={s}
                  onClick={() => setSimSpeed(s)}
                  title={label}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    simSpeed === s
                      ? 'bg-[#0D9488] text-white shadow-2xs'
                      : 'text-[#64748B] hover:text-[#172B3A] hover:bg-slate-200/50'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Route Preset Chips for Kolhapur */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F5F9] text-xs">
          <span className="text-[11px] font-semibold text-[#64748B]">Quick Kolhapur Corridors:</span>
          {[
            { label: 'Shiroli MIDC ➔ CPR Trauma Hospital', from: 'wh_shiroli_midc', to: 'hosp_cpr' },
            { label: 'Gokul Shirgaon ➔ Aster Aadhar Super Specialty', from: 'wh_gokul_shirgaon', to: 'hosp_aster_aadhar' },
            { label: 'Kagal 5-Star MIDC ➔ Rajarampuri Dark Store', from: 'wh_kagal_midc', to: 'store_rajarampuri' },
            { label: 'Kasaba Bawada ➔ D.Y. Patil Medical College', from: 'store_kasaba_bawada', to: 'hosp_dypatil' },
          ].map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPresetRoute(preset.from, preset.to)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#F0FDFA] hover:text-[#0D9488] text-slate-700 font-medium text-[11px] transition-colors cursor-pointer border border-transparent hover:border-[#CCFBF1]"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. REAL INTERACTIVE KOLHAPUR LEAFLET / GOOGLE MAP CANVAS & TELEMETRY HUD   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Real Live Map Container */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-xs relative flex flex-col min-h-[620px]">
          {/* Map Top Status Pill & Marking Guidance */}
          <div className="absolute top-4 left-4 z-1000 flex flex-col gap-2 pointer-events-auto">
            <div className="px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-[#E2E8F0] text-[#102A43] text-xs flex items-center gap-2.5 shadow-md">
              <span className={`w-2.5 h-2.5 rounded-full ${carSimRunning ? 'bg-[#059669] animate-ping' : 'bg-[#0D9488]'}`} />
              <span className="font-bold">
                {carSimRunning ? 'Simulating Live Vehicle on Road' : 'Kolhapur Dijkstra Road Routing Engine'}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[#0D9488] font-mono text-[11px] font-semibold">
                {activeRoutePlan?.source === 'osrm_live' ? 'Street Geometry Active' : 'Dijkstra Shortest Path'}
              </span>
            </div>

            {/* Dynamic Step Banner */}
            {markingStep !== 'idle' && (
              <div className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 animate-bounce">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {markingStep === 'mark_a'
                    ? 'Click anywhere on the map to set START POINT [A]'
                    : 'Click on the map to set DESTINATION POINT [B]'}
                </span>
              </div>
            )}
          </div>

          {/* Map Top-Right Follow & Layer Controls */}
          <div className="absolute top-4 right-4 z-1000 flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setFollowSelectedVehicle(!followSelectedVehicle)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border flex items-center gap-1.5 shadow-md cursor-pointer transition-all ${
                followSelectedVehicle
                  ? 'bg-[#0D9488] text-white border-[#0D9488]'
                  : 'bg-white/95 border-[#E2E8F0] text-[#64748B] hover:text-[#172B3A]'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Camera Lock: {followSelectedVehicle ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Floating Completion Telemetry HUD (Non-blocking, Keeps Map & All Warehouses 100% Visible!) */}
          {arrivalReportOpen && (
            <div className="absolute top-16 right-4 z-1000 max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-emerald-400 p-4 animate-in slide-in-from-top-3 space-y-3 pointer-events-auto">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#102A43]">
                      Delivery Arrived at {pointB.name.split(' (')[0]}!
                    </h4>
                    <p className="text-[10px] text-emerald-700 font-semibold">
                      ✓ Zero-incident road transit completed
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setArrivalReportOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  title="Close Card"
                >
                  ✕
                </button>
              </div>

              {/* Telemetry Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">Traversed</span>
                  <span className="font-bold text-[#102A43] font-mono">{activeRoutePlan?.distanceKm} km</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Sim Stopwatch</span>
                  <span className="font-bold text-teal-600 font-mono">{elapsedSimulationSec.toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Cold-Chain</span>
                  <span className="font-bold text-emerald-600 font-mono">{cargoTempC.toFixed(1)}°C (100%)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Routing</span>
                  <span className="font-bold text-blue-600 font-mono">Dijkstra Shortest</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-[11px] py-1.5"
                  icon={RotateCcw}
                  onClick={handleResetCarTrip}
                >
                  Replay
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1 text-[11px] py-1.5"
                  icon={FileText}
                  onClick={handleExportTripManifest}
                >
                  Waybill PDF
                </Button>
              </div>

              {/* Prominent Next Route Button */}
              <button
                onClick={() => {
                  setArrivalReportOpen(false);
                  setMarkingStep('mark_a');
                  addToast({
                    type: 'info',
                    title: 'Pick New Route',
                    message: 'Click any warehouse on the Kolhapur map to set Start Point [A].'
                  });
                }}
                className="w-full py-2 bg-gradient-to-r from-[#0D9488] to-[#0284C7] text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5" />
                Select Next Route [Pick on Map]
              </button>
            </div>
          )}

          {/* Floating Navigation Prompt HUD (Turn-by-turn banner) */}
          <div className="absolute bottom-14 left-4 right-4 z-1000 pointer-events-auto">
            <div className="p-3 rounded-xl bg-[#102A43]/90 backdrop-blur-md border border-white/10 text-white flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#0D9488] flex items-center justify-center font-bold text-white text-sm shrink-0">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-teal-300">Live Turn Maneuver</div>
                  <div className="text-xs font-bold text-white leading-tight">
                    {currentInstruction}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-300 block">Distance</span>
                  <span className="font-bold text-teal-300">
                    {traveledKm.toFixed(1)} / {activeRoutePlan?.distanceKm || 0} km
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-300 block">Speed</span>
                  <span className="font-bold text-white">{carSpeedKmH} km/h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Leaflet Map DOM Root Container */}
          <div 
            ref={mapContainerRef} 
            className="w-full h-full flex-1 min-h-[580px] z-10" 
            style={{ width: '100%', height: '100%' }}
          />

          {/* Map Bottom Legend */}
          <div className="p-3 bg-white border-t border-[#E2E8F0] flex flex-wrap items-center justify-between text-[11px] text-[#64748B] gap-3 z-20">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#0D9488] text-white flex items-center justify-center text-[8px] font-bold">A</span> Start Pin
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-[#DC2626] text-white flex items-center justify-center text-[8px] font-bold">B</span> Destination Pin
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-1 bg-[#0D9488] rounded" /> Shortest Road Polyline
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Active Vehicle Headlights
              </span>
            </div>
            <div className="font-mono text-[#0D9488] font-semibold">
              Kolhapur Region • Lat 16.6980, Lng 74.2400
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Live Telemetry HUD & Route Parameters */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
            {/* Header: Vehicle Plate & Status */}
            <div className="flex items-start justify-between pb-3 border-b border-[#F1F5F9]">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0D9488] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    <Car className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#102A43] leading-tight">
                      StockPilot BioCar Alpha
                    </h2>
                    <div className="text-[11px] text-[#64748B] font-mono">
                      MH-09-EV-2026 • Autonomous Kolhapur Pilot
                    </div>
                  </div>
                </div>
              </div>

              <Badge
                variant={carSimRunning ? 'teal' : traveledKm > 0 && !carSimRunning ? 'success' : 'neutral'}
                size="sm"
                dot
              >
                {carSimRunning ? 'En Route' : traveledKm > 0 ? 'Docked' : 'Standby'}
              </Badge>
            </div>

            {/* Trip Parameters & Origin / Destination Details */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="font-semibold">Route Summary</span>
                <span className="font-mono text-[#0D9488] font-bold">
                  {activeRoutePlan?.source === 'osrm_live' ? 'Street OSRM' : 'Dijkstra Graph'} ({activeRoutePlan?.computationTimeMs || 0.42}ms)
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0D9488] mt-1 shrink-0" />
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Origin Point [A]</div>
                    <div className="font-bold text-[#102A43]">{pointA.name}</div>
                    <div className="text-[10px] text-[#64748B] font-mono">Coord: {pointA.lat.toFixed(4)}, {pointA.lng.toFixed(4)}</div>
                  </div>
                </div>

                <div className="w-0.5 h-3 bg-slate-300 ml-1" />

                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-600 mt-1 shrink-0" />
                  <div>
                    <div className="text-[10px] text-[#64748B] uppercase font-bold">Destination Point [B]</div>
                    <div className="font-bold text-[#102A43]">{pointB.name}</div>
                    <div className="text-[10px] text-[#64748B] font-mono">Coord: {pointB.lat.toFixed(4)}, {pointB.lng.toFixed(4)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Telemetry HUD Gauges */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[#102A43] flex items-center justify-between">
                <span>Real-Time In-Transit Parameters</span>
                <span className="text-[10px] text-[#0D9488] font-mono">GPS 10Hz Feed</span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[#64748B]">
                  <span>Route Completion</span>
                  <span className="font-mono font-bold text-[#102A43]">
                    {activeRoutePlan?.distanceKm
                      ? Math.min(100, Math.round((traveledKm / activeRoutePlan.distanceKm) * 100))
                      : 0}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full bg-[#0D9488] transition-all duration-200"
                    style={{ 
                      width: `${activeRoutePlan?.distanceKm ? Math.min(100, (traveledKm / activeRoutePlan.distanceKm) * 100) : 0}%` 
                    }}
                  />
                </div>
              </div>

              {/* Live Parameters Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="text-[10px] text-[#64748B] flex items-center gap-1 font-semibold">
                    <Timer className="w-3 h-3 text-[#0D9488]" />
                    <span>Trip Stopwatch</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[#102A43] mt-0.5">
                    {formatTime(elapsedSimulationSec)}
                  </div>
                  <div className="text-[10px] text-[#64748B]">
                    ~{activeRoutePlan?.estimatedMinutes || 0} min road time
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="text-[10px] text-[#64748B] flex items-center gap-1 font-semibold">
                    <Gauge className="w-3 h-3 text-[#2563EB]" />
                    <span>Speedometer</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[#102A43] mt-0.5">
                    {carSpeedKmH} <span className="text-xs font-normal text-[#64748B]">km/h</span>
                  </div>
                  <div className="text-[10px] text-[#64748B]">
                    Heading {Math.round(carHeadingDeg)}°
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="text-[10px] text-[#64748B] flex items-center gap-1 font-semibold">
                    <Battery className="w-3 h-3 text-emerald-600" />
                    <span>EV Battery Level</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[#102A43] mt-0.5">
                    {batteryLevel.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    Regenerative Active
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <div className="text-[10px] text-[#64748B] flex items-center gap-1 font-semibold">
                    <ThermometerSnowflake className="w-3 h-3 text-cyan-600" />
                    <span>Cold-Chain Temp</span>
                  </div>
                  <div className="text-base font-bold font-mono text-cyan-700 mt-0.5">
                    {cargoTempC.toFixed(1)} °C
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    Compliant (2-8°C)
                  </div>
                </div>
              </div>
            </div>

            {/* Turn-by-Turn Steps Preview */}
            <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
              <div className="text-xs font-bold text-[#102A43]">
                Turn-by-Turn Maneuvers ({activeRoutePlan?.steps.length || 0} Steps)
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {activeRoutePlan?.steps.map((st, i) => (
                  <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2 text-[11px]">
                    <div className="w-4 h-4 rounded-full bg-[#102A43] text-white flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-[#102A43]">{st.instruction}</div>
                      <div className="text-[10px] text-[#64748B]">
                        {st.streetName} • {st.distanceMeters}m (~{st.durationSeconds}s)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={handleResetCarTrip}
              >
                Reset Car
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 text-xs"
                onClick={carSimRunning ? handlePauseCarTrip : handleStartCarTrip}
              >
                {carSimRunning ? 'Pause' : 'Start Simulation'}
              </Button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FleetSimulationPage;
