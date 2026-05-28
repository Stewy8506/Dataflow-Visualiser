import { useState } from 'react';
import { Html } from '@react-three/drei';

interface ThreeDNodeProps {
  node: any;
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

export function ThreeDNode({ node, isSelected, isDimmed, onClick }: ThreeDNodeProps) {
  const [hovered, setHovered] = useState(false);

  let shape = 'sphere';
  let color = '#3b82f6';
  let emissive = '#1d4ed8';

  const group = node.group ? node.group.toLowerCase() : '';
  const id = node.id ? node.id.toLowerCase() : '';

  if (id.includes('/api/') || id.includes('route.') || id.includes('/server/') || id.includes('/backend/') || id.includes('src-tauri')) {
    shape = 'box';
    color = '#10b981';
    emissive = '#047857';
  } else if (group === 'ts' || group === 'js') {
    shape = 'octahedron';
    color = '#f59e0b';
    emissive = '#b45309';
  }

  const scale = isSelected ? 1.5 : hovered ? 1.3 : 1.0;
  const opacity = isDimmed ? 0.15 : 1.0;

  return (
    <group 
      position={[node.x, node.y, node.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh scale={[scale, scale, scale]}>
        {shape === 'box' ? (
          <boxGeometry args={[0.7, 0.7, 0.7]} />
        ) : shape === 'octahedron' ? (
          <octahedronGeometry args={[0.5]} />
        ) : (
          <sphereGeometry args={[0.4, 32, 32]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={isSelected ? 1.5 : hovered ? 1.0 : 0.4}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={opacity}
        />
      </mesh>

      {(hovered || isSelected) && (
        <Html distanceFactor={12} position={[0, 0.8, 0]} center>
          <div
            className="px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none select-none flex flex-col items-center"
            style={{
              background: 'rgba(17,17,24,0.92)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              animation: 'nebula-fade-in 0.15s ease forwards',
            }}
          >
            <span className="font-semibold font-sans text-xs text-[#e2e8f0] tracking-wide">{node.label}</span>
            {node.semantic_group && (
              <span className="text-[8px] font-bold text-blue-400 uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                {node.semantic_group}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
