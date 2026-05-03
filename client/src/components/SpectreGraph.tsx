'use client';

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { AnalysisResult, ThreatType, THREAT_COLORS } from '@/lib/types';
import { hashToPosition } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   PARTICLE FIELD — "Dark Water" background
   Thousands of tiny dots drifting slowly at 3% opacity
   ═══════════════════════════════════════════════════════════════════════════ */

function SonarGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);
  
  useFrame(({ clock }) => {
    if (!gridRef.current) return;
    const t = clock.getElapsedTime();
    // Slowly drift the grid
    gridRef.current.position.z = (t * 2) % 10;
  });

  return (
    <group position={[0, -15, 0]}>
      <gridHelper
        ref={gridRef}
        args={[200, 40, '#0A3D6B', '#020408']}
      />
      <gridHelper
        args={[200, 10, '#0E6BA8', '#020408']}
        position={[0, -0.1, 0]}
      />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRAPH NODE — Oblate spheroid with fog halo
   ═══════════════════════════════════════════════════════════════════════════ */

interface NodeData {
  id: string;
  position: [number, number, number];
  color: string;
  threat: ThreatType;
  birthTime: number;
  flagged: boolean;
}

function GraphNode({ node, now, isHighlighted, isDimmed, onClick }: { node: NodeData; now: number; isHighlighted?: boolean; isDimmed?: boolean; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const age = (now - node.birthTime) / 1000;
  const isFresh = age < 0.18;
  const isFlagged = node.flagged;

  useFrame(({ clock }) => {
    if (!meshRef.current || !coreRef.current || !ringRef.current) return;
    const t = clock.getElapsedTime();

    // Tactical rotation
    meshRef.current.rotation.y = t * 0.5;
    meshRef.current.rotation.z = t * 0.2;
    ringRef.current.rotation.x = Math.PI / 2;

    if (isFresh) {
      const progress = Math.min(age / 0.18, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      meshRef.current.scale.setScalar(eased * 1.2);
      ringRef.current.scale.setScalar(eased * 2.5);
    } else if (isFlagged && age < 2) {
      const beat = age - 0.18;
      let scale = 1.2;
      if (beat < 0.04) {
        scale = 1.2 + (beat / 0.04) * 0.3;
      } else if (beat < 0.08) {
        scale = 1.5 - ((beat - 0.04) / 0.04) * 0.2;
      } else {
        scale = 1.3;
      }
      meshRef.current.scale.setScalar(scale);
      ringRef.current.scale.setScalar(scale * 2.2);
    } else {
      const breath = 1.2 + Math.sin(t * 3) * 0.05;
      meshRef.current.scale.setScalar(breath);
      ringRef.current.scale.setScalar(breath * 2.0);
    }

    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 
      isDimmed && !hovered ? 0.05 :
      isFlagged ? 0.4 + Math.sin(t * 8) * 0.2 : Math.max(0, 0.15 - age * 0.02);
  });

  const color = new THREE.Color(node.color);

  return (
    <group 
      position={node.position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {/* HTML Tactical Label */}
      {(hovered || isHighlighted) && (
        <Html position={[0, 1.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(2, 4, 8, 0.8)',
            border: `1px solid ${color.getStyle()}`,
            padding: '4px 8px',
            borderRadius: '2px',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '10px',
            whiteSpace: 'nowrap',
            boxShadow: `0 0 10px ${color.getStyle()}44`,
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            <div style={{ color: color.getStyle(), fontWeight: 'bold', marginBottom: '2px' }}>
              {node.threat === 'CLEAN' ? 'NODE_ACTIVE' : node.threat}
            </div>
            {node.id.slice(0, 8)}...{node.id.slice(-4)}
          </div>
        </Html>
      )}

      {/* Tactical Radar Ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[0.9, 1.0, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Wireframe Shell */}
      <mesh ref={meshRef} scale={isFresh ? [0.1, 0.1, 0.1] : [1.2, 1.2, 1.2]}>
        <octahedronGeometry args={[0.4, 0]} />
        <meshBasicMaterial
          color={color}
          wireframe={true}
          transparent
          opacity={isFlagged ? 0.9 : 0.4}
        />
      </mesh>

      {/* Solid Core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.15, 0]} />
        <meshBasicMaterial
          color={isFlagged || isHighlighted || hovered ? '#ffffff' : color}
          transparent
          opacity={isDimmed && !hovered ? 0.2 : (isFlagged || isHighlighted || hovered ? 1 : 0.7)}
        />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRAPH EDGE — Tapered tube with sonar pulse
   ═══════════════════════════════════════════════════════════════════════════ */

function GraphEdge({
  start,
  end,
  color,
  threat,
  isDimmed,
  isHighlighted,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  threat: ThreatType;
  isDimmed?: boolean;
  isHighlighted?: boolean;
}) {
  const lineObj = useMemo(() => {
    const s = new THREE.Vector3(...start);
    const e = new THREE.Vector3(...end);
    const geometry = new THREE.BufferGeometry().setFromPoints([s, e]);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [start, end, color]);

  useFrame(({ clock }) => {
    const mat = lineObj.material as THREE.LineBasicMaterial;
    if (isDimmed) {
      mat.opacity = 0.02; // barely visible
    } else if (isHighlighted) {
      mat.opacity = 0.8 + Math.sin(clock.getElapsedTime() * 8) * 0.2;
    } else if (threat === 'CLEAN') {
      // Hide clean edges entirely unless highlighted/hovered to reduce clutter
      mat.opacity = 0.0;
    } else {
      mat.opacity = 0.35 + Math.sin(clock.getElapsedTime() * 4) * 0.1;
    }
  });

  return <primitive object={lineObj} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAMERA — Dutch angle with anomaly auto-rotate
   ═══════════════════════════════════════════════════════════════════════════ */

function CameraController({ latestThreatPos }: { latestThreatPos: [number, number, number] | null }) {
  const { camera } = useThree();
  const targetRotation = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Initial dutch angle — 4 degrees tilt
    camera.rotation.z = (4 * Math.PI) / 180;
    camera.position.set(0, 5, 60);
    camera.lookAt(0, 0, 0);
    camera.rotation.z = (4 * Math.PI) / 180;
  }, [camera]);

  useFrame(() => {
    // Slow auto-orbit
    const t = Date.now() * 0.00005;
    camera.position.x = Math.sin(t) * 60;
    camera.position.z = Math.cos(t) * 60;
    camera.position.y = 5 + Math.sin(t * 2) * 3;
    camera.lookAt(0, 0, 0);
    // Maintain dutch angle
    camera.rotation.z = (4 * Math.PI) / 180;
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SPECTRE GRAPH COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

interface SpectreGraphProps {
  events: AnalysisResult[];
  latestEvent: AnalysisResult | null;
  selectedTx?: string | null;
  onSelectTx?: (txid: string | null) => void;
}

const MAX_NODES = 150;
const MAX_EDGES = 300;

export default function SpectreGraph({ events, latestEvent, selectedTx, onSelectTx }: SpectreGraphProps) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<{
    start: [number, number, number];
    end: [number, number, number];
    color: string;
    threat: ThreatType;
    key: string;
    txid: string;
  }[]>([]);
  const [now, setNow] = useState(Date.now());
  const nodeMap = useRef<Map<string, NodeData>>(new Map());
  const [latestThreatPos, setLatestThreatPos] = useState<[number, number, number] | null>(null);

  // Update clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  // Process new events into nodes and edges
  useEffect(() => {
    if (!latestEvent) return;

    const result = latestEvent;
    const color = THREAT_COLORS[result.threat] || THREAT_COLORS.CLEAN;
    const isThreat = result.threat !== 'CLEAN';
    const birthTime = Date.now();

    // Add source address nodes
    const newNodes: NodeData[] = [];
    result.source_addresses.forEach(addr => {
      if (!nodeMap.current.has(addr)) {
        const pos = hashToPosition(addr, 35);
        const node: NodeData = {
          id: addr,
          position: pos,
          color: isThreat ? color : THREAT_COLORS.CLEAN,
          threat: result.threat,
          birthTime,
          flagged: isThreat,
        };
        nodeMap.current.set(addr, node);
        newNodes.push(node);
      } else if (isThreat) {
        const existing = nodeMap.current.get(addr)!;
        existing.color = color;
        existing.threat = result.threat;
        existing.flagged = true;
        existing.birthTime = birthTime;
      }
    });

    // Add destination address nodes
    result.dest_addresses.forEach(addr => {
      if (!nodeMap.current.has(addr)) {
        const pos = hashToPosition(addr, 35);
        const node: NodeData = {
          id: addr,
          position: pos,
          color: isThreat ? color : THREAT_COLORS.CLEAN,
          threat: result.threat,
          birthTime,
          flagged: isThreat,
        };
        nodeMap.current.set(addr, node);
        newNodes.push(node);
      } else if (isThreat) {
        const existing = nodeMap.current.get(addr)!;
        existing.color = color;
        existing.threat = result.threat;
        existing.flagged = true;
        existing.birthTime = birthTime;
      }
    });

    // Create edges
    const newEdges: typeof edges = [];
    result.source_addresses.forEach(src => {
      result.dest_addresses.forEach(dst => {
        const srcNode = nodeMap.current.get(src);
        const dstNode = nodeMap.current.get(dst);
        if (srcNode && dstNode) {
          newEdges.push({
            start: srcNode.position,
            end: dstNode.position,
            color,
            threat: result.threat,
            key: `${src}-${dst}-${result.txid}`,
            txid: result.txid,
          });
        }
      });
    });

    if (isThreat && result.source_addresses.length > 0) {
      const flaggedAddr = result.source_addresses[0];
      const flaggedNode = nodeMap.current.get(flaggedAddr);
      if (flaggedNode) {
        setLatestThreatPos(flaggedNode.position);
      }
    }

    // Prune old nodes
    if (nodeMap.current.size > MAX_NODES) {
      const entries = Array.from(nodeMap.current.entries());
      entries
        .sort((a, b) => a[1].birthTime - b[1].birthTime)
        .slice(0, entries.length - MAX_NODES)
        .forEach(([key]) => nodeMap.current.delete(key));
    }

    setNodes(Array.from(nodeMap.current.values()));
    setEdges(prev => [...newEdges, ...prev].slice(0, MAX_EDGES));
  }, [latestEvent]);

  // Calculate selected nodes based on selectedTx
  const selectedAddrs = useMemo(() => {
    if (!selectedTx) return new Set<string>();
    const ev = events.find(e => e.txid === selectedTx);
    if (!ev) return new Set<string>();
    return new Set([...ev.source_addresses, ...ev.dest_addresses]);
  }, [selectedTx, events]);

  const hasSelection = selectedAddrs.size > 0;

  return (
    <div className="spectre-void">
      <Canvas
        camera={{ fov: 55, near: 0.1, far: 500, position: [0, 5, 60] }}
        style={{ background: '#020408' }}
        gl={{ antialias: true, alpha: false }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.15} />
        <pointLight position={[30, 30, 30]} intensity={0.4} color="#0E6BA8" />
        <pointLight position={[-30, -20, -30]} intensity={0.2} color="#FF1E56" />
        <directionalLight position={[0, 20, 10]} intensity={0.2} />

        {/* Orbit Controls instead of fixed Dutch angle camera */}
        <OrbitControls 
          autoRotate={!hasSelection}
          autoRotateSpeed={0.8}
          enableDamping
          dampingFactor={0.05}
          maxDistance={150}
          minDistance={10}
          maxPolarAngle={Math.PI / 1.5}
        />

        {/* Post-Processing Effects */}
        <EffectComposer disableNormalPass multisampling={4}>
          <Bloom
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            intensity={2.5}
            mipmapBlur
          />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={new THREE.Vector2(0.004, 0.004)}
          />
          <Vignette
            eskil={false}
            offset={0.2}
            darkness={1.5}
          />
        </EffectComposer>

        {/* Tactical Sonar Grid */}
        <SonarGrid />

        {/* Edges */}
        {edges.map(edge => {
          const isHighlighted = selectedTx === edge.txid;
          const isDimmed = hasSelection && !isHighlighted;
          return (
            <GraphEdge
              key={edge.key}
              start={edge.start}
              end={edge.end}
              color={edge.color}
              threat={edge.threat}
              isHighlighted={isHighlighted}
              isDimmed={isDimmed}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const isHighlighted = selectedAddrs.has(node.id);
          const isDimmed = hasSelection && !isHighlighted;
          return (
            <GraphNode 
              key={node.id} 
              node={node} 
              now={now} 
              isHighlighted={isHighlighted}
              isDimmed={isDimmed}
              onClick={() => {
                const ev = events.find(e => e.source_addresses.includes(node.id) || e.dest_addresses.includes(node.id));
                if (ev) {
                  onSelectTx?.(ev.txid === selectedTx ? null : ev.txid);
                }
              }}
            />
          );
        })}
      </Canvas>

      {/* Corner overlays */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          pointerEvents: 'none',
        }}
      >
        <span
          className="font-mono"
          style={{ fontSize: '9px', color: 'rgba(192,200,212,0.2)', letterSpacing: '0.1em' }}
        >
          NODES: {nodes.length} │ EDGES: {edges.length}
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          pointerEvents: 'none',
        }}
      >
        <span
          className="font-mono"
          style={{ fontSize: '9px', color: 'rgba(192,200,212,0.2)', letterSpacing: '0.1em' }}
        >
          WebGL │ THREE.js
        </span>
      </div>
    </div>
  );
}
