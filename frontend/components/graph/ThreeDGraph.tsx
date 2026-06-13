import { useState, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeDNode } from './ThreeDNode';

interface Node3D {
  id: string;
  label: string;
  group: string;
  semantic_group?: string;
  summary?: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

interface ThreeDGraphProps {
  graphData: any;
  selectedNode: any | null;
  onNodeSelect: (node: any) => void;
}

interface CameraControllerProps {
  targetPos: THREE.Vector3 | null;
}

function CameraController({ targetPos }: CameraControllerProps) {
  const { camera, controls } = useThree();
  const initialCameraPos = useRef(new THREE.Vector3(0, 0, 18));

  useFrame(() => {
    if (targetPos) {
      const desiredCamPos = new THREE.Vector3(
        targetPos.x,
        targetPos.y,
        targetPos.z + 7
      );
      camera.position.lerp(desiredCamPos, 0.08);

      if (controls) {
        const orbitControls = controls as any;
        orbitControls.target.lerp(targetPos, 0.08);
        orbitControls.update();
      }
    } else {
      const origin = new THREE.Vector3(0, 0, 0);
      camera.position.lerp(initialCameraPos.current, 0.04);
      if (controls) {
        const orbitControls = controls as any;
        orbitControls.target.lerp(origin, 0.04);
        orbitControls.update();
      }
    }
  });

  return null;
}

export function ThreeDGraph({ graphData, selectedNode, onNodeSelect }: ThreeDGraphProps) {
  const [nodes3D, setNodes3D] = useState<Node3D[]>([]);

  useEffect(() => {
    if (!graphData?.nodes || graphData.nodes.length === 0) {
      setNodes3D([]);
      return;
    }

    const existingMap = new Map(nodes3D.map(n => [n.id, n]));

    const initializedNodes: Node3D[] = graphData.nodes.map((n: any) => {
      const existing = existingMap.get(n.id);
      if (existing) {
        return {
          ...existing,
          label: n.label,
          group: n.group,
          semantic_group: n.semantic_group,
          summary: n.summary
        };
      }
      return {
        id: n.id,
        label: n.label,
        group: n.group,
        semantic_group: n.semantic_group,
        summary: n.summary,
        x: (Math.random() - 0.5) * 5,
        y: (Math.random() - 0.5) * 5,
        z: (Math.random() - 0.5) * 5,
        vx: 0,
        vy: 0,
        vz: 0
      };
    });

    const kRep = 1.6;
    const kAtt = 0.06;
    const kGrav = 0.02;
    const friction = 0.85;
    
    const edges = graphData.edges || [];
    const nodeMap = new Map(initializedNodes.map(n => [n.id, n]));

    for (let tick = 0; tick < 180; tick++) {
      for (let i = 0; i < initializedNodes.length; i++) {
        const u = initializedNodes[i];
        for (let j = i + 1; j < initializedNodes.length; j++) {
          const v = initializedNodes[j];
          let dx = v.x - u.x;
          const dy = v.y - u.y;
          const dz = v.z - u.z;
          let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist < 0.1) {
            dx = 0.1;
            dist = 0.1;
          }
          const force = kRep / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const fz = (dz / dist) * force;

          u.vx -= fx;
          u.vy -= fy;
          u.vz -= fz;

          v.vx += fx;
          v.vy += fy;
          v.vz += fz;
        }
      }

      edges.forEach((edge: any) => {
        const u = nodeMap.get(edge.source);
        const v = nodeMap.get(edge.target);
        if (u && v) {
          const dx = v.x - u.x;
          const dy = v.y - u.y;
          const dz = v.z - u.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist > 0.1) {
            const force = kAtt * dist;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            const fz = (dz / dist) * force;

            u.vx += fx;
            u.vy += fy;
            u.vz += fz;

            v.vx -= fx;
            v.vy -= fy;
            v.vz -= fz;
          }
        }
      });

      initializedNodes.forEach(n => {
        n.vx -= n.x * kGrav;
        n.vy -= n.y * kGrav;
        n.vz -= n.z * kGrav;

        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;

        n.vx *= friction;
        n.vy *= friction;
        n.vz *= friction;
      });
    }

    setNodes3D(initializedNodes);
  }, [graphData]);

  const connectedIds = useMemo(() => {
    if (!selectedNode) return null;
    const connected = new Set<string>();
    connected.add(selectedNode.id);
    
    if (graphData?.edges) {
      graphData.edges.forEach((edge: any) => {
        if (edge.source === selectedNode.id) connected.add(edge.target);
        if (edge.target === selectedNode.id) connected.add(edge.source);
      });
    }
    return connected;
  }, [selectedNode, graphData]);

  const nodesMap = useMemo(() => {
    return new Map(nodes3D.map(n => [n.id, n]));
  }, [nodes3D]);

  const cameraTarget = useMemo(() => {
    if (!selectedNode || nodes3D.length === 0) return null;
    const matched = nodesMap.get(selectedNode.id);
    if (!matched) return null;
    return new THREE.Vector3(matched.x, matched.y, matched.z);
  }, [selectedNode, nodesMap]);

  const handleNodeClick = (node: Node3D) => {
    onNodeSelect({
      id: node.id,
      data: {
        label: node.label,
        path: node.id,
        group: node.group,
        semantic_group: node.semantic_group,
        summary: node.summary
      }
    });
  };

  const handleCanvasClick = () => {
    onNodeSelect(null);
  };

  return (
    <div className="w-full h-full bg-[#0a0a10]" onClick={handleCanvasClick}>
      <Canvas camera={{ position: [0, 0, 18], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1.2} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Stars radius={120} depth={50} count={6000} factor={4} saturation={0.5} fade speed={1.2} />

        {nodes3D.map((node) => {
          const isSelected = selectedNode?.id === node.id;
          const isDimmed = connectedIds !== null && !connectedIds.has(node.id);
          return (
            <ThreeDNode
              key={node.id}
              node={node}
              isSelected={isSelected}
              isDimmed={isDimmed}
              onClick={() => handleNodeClick(node)}
            />
          );
        })}

        {nodes3D.length > 0 && graphData?.edges?.map((edge: any, idx: number) => {
          const u = nodesMap.get(edge.source);
          const v = nodesMap.get(edge.target);
          if (!u || !v) return null;

          const isDirect = selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id);
          const isDimmed = selectedNode && !isDirect;

          return (
            <Line
              key={`edge-${idx}`}
              points={[[u.x, u.y, u.z], [v.x, v.y, v.z]]}
              color={isDirect ? "#60a5fa" : "#334155"}
              lineWidth={isDirect ? 2.5 : 1}
              transparent
              opacity={isDimmed ? 0.04 : isDirect ? 0.9 : 0.3}
            />
          );
        })}

        <CameraController targetPos={cameraTarget} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} maxDistance={40} minDistance={3} />
      </Canvas>
    </div>
  );
}
