import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

interface GraphData {
  nodes: { id: string; label: string; group: string }[];
  edges: { source: string; target: string }[];
}

function App() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [status, setStatus] = useState("Ready to parse codebase");

  const handleSelectDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
      });
      if (selectedPath) {
        setStatus(`Parsing ${selectedPath}...`);
        const result: GraphData = await invoke("parse_codebase", { path: selectedPath });
        setGraphData(result);
        setStatus(`Parsed ${result.nodes.length} files`);
      }
    } catch (e) {
      console.error(e);
      setStatus("Error parsing codebase");
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-80 h-full bg-surface/80 backdrop-blur-md border-r border-slate-700 p-6 flex flex-col z-10">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 mb-8">
          CodeMapper 3D
        </h1>
        
        <div className="flex-1 space-y-4">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wider">Project</h2>
            <button 
              onClick={handleSelectDirectory}
              className="w-full py-2 px-4 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm cursor-pointer"
            >
              Select Directory
            </button>
          </div>
          
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <h2 className="text-sm font-semibold text-text-muted mb-2 uppercase tracking-wider">AI Assistant</h2>
            <div className="text-xs text-slate-400 mb-3">Ask questions about your codebase architecture.</div>
            <textarea 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
              rows={3}
              placeholder="What does the auth service do?"
            />
            <button className="mt-2 w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium text-sm">
              Ask AI
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas Area */}
      <div className="flex-1 relative">
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <color attach="background" args={["#050510"]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          {graphData ? (
            graphData.nodes.map((node) => (
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
        
        {/* Floating overlays */}
        <div className="absolute bottom-6 right-6 bg-surface/50 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-700/50 text-xs text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
          {status}
        </div>
      </div>
    </div>
  );
}

export default App;
