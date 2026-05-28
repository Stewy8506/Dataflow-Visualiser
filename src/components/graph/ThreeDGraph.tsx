import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';

interface ThreeDGraphProps {
  graphData: any;
}

export function ThreeDGraph({ graphData }: ThreeDGraphProps) {
  return (
    <div className="w-full h-full bg-[#050510]">
      <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {graphData?.nodes?.length > 0 ? (
          graphData.nodes.map((node: any) => (
            <mesh key={node.id} position={[(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20]}>
              <sphereGeometry args={[0.5, 16, 16]} />
              <meshStandardMaterial 
                color={node.group === "ts" || node.group === "tsx" ? "#3178c6" : "#f7df1e"} 
                emissive={node.group === "ts" || node.group === "tsx" ? "#3178c6" : "#f7df1e"} 
                emissiveIntensity={0.5} 
              />
            </mesh>
          ))
        ) : (
          <>
            <mesh position={[-2, 0, 0]}>
              <sphereGeometry args={[1, 32, 32]} />
              <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[2, 2, -2]}>
              <boxGeometry args={[1.5, 1.5, 1.5]} />
              <meshStandardMaterial color="#10b981" emissive="#047857" emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[0, -2, 2]}>
              <octahedronGeometry args={[1]} />
              <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.5} />
            </mesh>
          </>
        )}
        
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
