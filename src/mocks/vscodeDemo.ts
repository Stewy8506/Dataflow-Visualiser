import { GraphData } from '../types';

export const vscodeGraphData: GraphData = {
  nodes: [
    {
      id: "https://github.com/microsoft/vscode/src/vs/workbench/browser/workbench.ts",
      label: "workbench.ts",
      group: "src/vs/workbench/browser",
      semantic_group: "Core Workbench Layer",
      summary: "Core VS Code Workbench class orchestrating the activity bar, panel layout, status bar, and workspace services.",
      metrics: {
        function_count: 42,
        import_count: 18,
        complexity_score: "High"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/workbench/browser/parts/editor/editorPart.ts",
      label: "editorPart.ts",
      group: "src/vs/workbench/browser/parts/editor",
      semantic_group: "UI Layout Layer",
      summary: "Manages multiple editor grids, tab switcher lists, tab pool optimizations, and editor render containers.",
      metrics: {
        function_count: 28,
        import_count: 9,
        complexity_score: "High"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts",
      label: "terminalInstance.ts",
      group: "src/vs/workbench/contrib/terminal/browser",
      semantic_group: "Integrated Terminal UI",
      summary: "Web-based terminal emulator widget that binds xterm.js into a native Tauri-style bottom panel component.",
      metrics: {
        function_count: 19,
        import_count: 6,
        complexity_score: "Medium"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/editor/common/model/textModel.ts",
      label: "textModel.ts",
      group: "src/vs/editor/common/model",
      semantic_group: "Editor Text Buffer",
      summary: "Core text buffer management containing line state arrays, tokenizer events, search indices, and marker references.",
      metrics: {
        function_count: 68,
        import_count: 14,
        complexity_score: "High"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/platform/instantiation/common/instantiationService.ts",
      label: "instantiationService.ts",
      group: "src/vs/platform/instantiation/common",
      semantic_group: "Dependency Injection",
      summary: "TypeScript dependency injection container. Handles service decorators, constructor injections, and cyclic resolution.",
      metrics: {
        function_count: 15,
        import_count: 4,
        complexity_score: "Medium"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/platform/configuration/common/configurationService.ts",
      label: "configurationService.ts",
      group: "src/vs/platform/configuration/common",
      semantic_group: "Configuration Layer",
      summary: "Monitors user/workspace settings files, manages configuration override caches, and dispatches value updates.",
      metrics: {
        function_count: 22,
        import_count: 7,
        complexity_score: "Medium"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/platform/files/node/watcher/nsfw/src/lib.rs",
      label: "lib.rs",
      group: "src/vs/platform/files/node/watcher/nsfw/src",
      semantic_group: "Rust Native Watcher",
      summary: "Rust native filesystem events watcher bridge using native file APIs for multi-threaded path notification alerts.",
      metrics: {
        function_count: 12,
        import_count: 5,
        complexity_score: "Medium"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/platform/files/node/watcher/nsfw/Cargo.toml",
      label: "Cargo.toml",
      group: "src/vs/platform/files/node/watcher/nsfw",
      semantic_group: "Rust Configuration",
      summary: "Rust dependencies manifest describing native dependencies, OS flags, and target optimizations.",
      metrics: {
        function_count: 0,
        import_count: 0,
        complexity_score: "Low"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/build/lib/electron.py",
      label: "electron.py",
      group: "build/lib",
      semantic_group: "Python Build Scripts",
      summary: "Python script executing electron runner validation, binary downloads, checksum hashing, and archive decompression.",
      metrics: {
        function_count: 8,
        import_count: 4,
        complexity_score: "Medium"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/scripts/test.py",
      label: "test.py",
      group: "scripts",
      semantic_group: "Python Test Run scripts",
      summary: "Test orchestration execution runner launching test harness processes and reporting integration test exits.",
      metrics: {
        function_count: 6,
        import_count: 3,
        complexity_score: "Medium"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/base/node/spdlog/spdlog.cc",
      label: "spdlog.cc",
      group: "src/vs/base/node/spdlog",
      semantic_group: "C++ Async Logging",
      summary: "C++ native bindings wrapping the high-performance spdlog logging library for asynchronous, low-overhead file logging.",
      metrics: {
        function_count: 14,
        import_count: 8,
        complexity_score: "High"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/base/node/spdlog/binding.gyp",
      label: "binding.gyp",
      group: "src/vs/base/node/spdlog",
      semantic_group: "C++ Build Configurations",
      summary: "GYP compilation manifest describing compilation flags, header routes, linking settings, and binary destinations.",
      metrics: {
        function_count: 0,
        import_count: 0,
        complexity_score: "Low"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/src/vs/workbench/browser/media/style.css",
      label: "style.css",
      group: "src/vs/workbench/browser/media",
      semantic_group: "CSS Global Styles",
      summary: "Global CSS theme overrides declaring component boundaries, flex alignments, activity bar borders, and overlays.",
      metrics: {
        function_count: 0,
        import_count: 0,
        complexity_score: "Low"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/README.md",
      label: "README.md",
      group: ".",
      semantic_group: "Documentation Details",
      summary: "Core documentation describing visual configurations, installation prerequisites, and contribution workflows.",
      metrics: {
        function_count: 0,
        import_count: 0,
        complexity_score: "Low"
      }
    },
    {
      id: "https://github.com/microsoft/vscode/package.json",
      label: "package.json",
      group: ".",
      semantic_group: "Package Manifest Details",
      summary: "Vitals manifest outlining dependencies list, compiler configurations, extension points, and build commands.",
      metrics: {
        function_count: 0,
        import_count: 0,
        complexity_score: "Low"
      }
    }
  ],
  edges: [
    {
      source: "https://github.com/microsoft/vscode/src/vs/workbench/browser/workbench.ts",
      target: "https://github.com/microsoft/vscode/src/vs/workbench/browser/parts/editor/editorPart.ts",
      via: "editorService"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/workbench/browser/workbench.ts",
      target: "https://github.com/microsoft/vscode/src/vs/platform/instantiation/common/instantiationService.ts",
      via: "createInstance"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/workbench/browser/parts/editor/editorPart.ts",
      target: "https://github.com/microsoft/vscode/src/vs/editor/common/model/textModel.ts",
      via: "openEditor"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/workbench/browser/workbench.ts",
      target: "https://github.com/microsoft/vscode/src/vs/platform/configuration/common/configurationService.ts",
      via: "registerConfiguration"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/workbench/browser/workbench.ts",
      target: "https://github.com/microsoft/vscode/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts",
      via: "terminalService"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/workbench/browser/workbench.ts",
      target: "https://github.com/microsoft/vscode/src/vs/workbench/browser/media/style.css",
      via: "importStyles"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/editor/common/model/textModel.ts",
      target: "https://github.com/microsoft/vscode/src/vs/base/node/spdlog/spdlog.cc",
      via: "nativeLogger"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/base/node/spdlog/spdlog.cc",
      target: "https://github.com/microsoft/vscode/src/vs/base/node/spdlog/binding.gyp",
      via: "buildConfig"
    },
    {
      source: "https://github.com/microsoft/vscode/src/vs/platform/files/node/watcher/nsfw/src/lib.rs",
      target: "https://github.com/microsoft/vscode/src/vs/platform/files/node/watcher/nsfw/Cargo.toml",
      via: "cargoDeps"
    },
    {
      source: "https://github.com/microsoft/vscode/scripts/test.py",
      target: "https://github.com/microsoft/vscode/build/lib/electron.py",
      via: "importRunner"
    },
    {
      source: "https://github.com/microsoft/vscode/build/lib/electron.py",
      target: "https://github.com/microsoft/vscode/package.json",
      via: "readDeps"
    }
  ]
};

export const vscodeFileContents: Record<string, string> = {
  "/src/vs/workbench/browser/workbench.ts": `
import React, { useState } from 'react';
import { EditorPart } from './parts/editor/editorPart';
import { InstantiationService } from '../../platform/instantiation/common/instantiationService';
import { TerminalInstance } from '../contrib/terminal/browser/terminalInstance';

export default function Workbench() {
  const [activeTab, setActiveTab] = useState('Welcome');
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#09090b',
      color: '#d4d4d8',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '12px'
    }}>
      {/* Activity Bar & Sidebar & Editor */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Activity Bar */}
        <div style={{ 
          width: 44, 
          backgroundColor: '#18181b', 
          borderRight: '1px solid #27272a',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: '12px 0' 
        }}>
          <div style={{ margin: '12px 0', fontSize: 18, cursor: 'pointer', opacity: 0.9 }}>📁</div>
          <div style={{ margin: '12px 0', fontSize: 18, cursor: 'pointer', opacity: 0.5 }}>🔍</div>
          <div style={{ margin: '12px 0', fontSize: 18, cursor: 'pointer', opacity: 0.5 }}>🌿</div>
        </div>
        {/* Editor Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ 
            padding: '8px 16px', 
            borderBottom: '1px solid #27272a', 
            fontSize: 11, 
            color: '#a1a1aa',
            fontFamily: 'monospace'
          }}>
            vscode/src/vs/workbench/browser/workbench.ts
          </div>
          <div style={{ flex: 1, padding: 20 }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#ffffff', fontWeight: 500, fontSize: '15px' }}>VS Code Workbench (Demo)</h3>
            <p style={{ fontSize: 13, lineHeight: '1.6', color: '#a1a1aa' }}>
              This is a live interactive simulation of the VS Code workbench.
            </p>
            <div style={{ marginTop: 20 }}>
              <EditorPart activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>
            <div style={{ marginTop: 20 }}>
              <TerminalInstance />
            </div>
          </div>
        </div>
      </div>
      {/* Status Bar */}
      <div style={{ 
        height: 22, 
        backgroundColor: '#18181b', 
        borderTop: '1px solid #27272a',
        color: '#ffffff', 
        fontSize: 11, 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 10px',
        fontWeight: 'bold'
      }}>
        <span style={{ color: '#10b981' }}>● Mode: VS Code Live Demo</span>
      </div>
    </div>
  );
}
  `,

  "/src/vs/workbench/browser/parts/editor/editorPart.ts": `
import React from 'react';

export function EditorPart({ activeTab, setActiveTab }) {
  const tabs = ['Welcome', 'settings.json', 'textModel.ts'];
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #27272a' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px',
              backgroundColor: activeTab === tab ? '#27272a' : '#18181b',
              color: activeTab === tab ? '#ffffff' : '#a1a1aa',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              borderRadius: '4px 4px 0 0',
              fontFamily: 'monospace'
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div style={{ 
        padding: 15, 
        backgroundColor: '#18181b', 
        minHeight: 120, 
        border: '1px solid #27272a', 
        borderTop: 'none',
        borderRadius: '0 0 6px 6px'
      }}>
        {activeTab === 'Welcome' && (
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: '#60a5fa' }}>Welcome to VS Code Web</h4>
            <p style={{ fontSize: 12, color: '#a1a1aa' }}>Click tabs to switch views.</p>
          </div>
        )}
        {activeTab === 'settings.json' && (
          <pre style={{ margin: 0, fontSize: 11, color: '#38bdf8', fontFamily: 'monospace' }}>
{\`{
  "editor.fontSize": 14,
  "editor.wordWrap": "on",
  "workbench.colorTheme": "Default Dark Modern"
}\`}
          </pre>
        )}
        {activeTab === 'textModel.ts' && (
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: '#f43f5e' }}>TextModel Instance</h4>
            <p style={{ fontSize: 12, color: '#a1a1aa' }}>Model represents buffer data. Click the textModel node on the canvas to preview the editor core!</p>
          </div>
        )}
      </div>
    </div>
  );
}
  `,

  "/src/vs/workbench/contrib/terminal/browser/terminalInstance.ts": `
import React, { useState } from 'react';

export function TerminalInstance() {
  const [history, setHistory] = useState(['$ node -v', 'v20.11.0', '$ git status', 'On branch main. Nothing to commit.']);
  const [cmd, setCmd] = useState('');
  
  return (
    <div style={{ 
      backgroundColor: '#0c0c0d', 
      border: '1px solid #27272a', 
      borderRadius: '6px',
      padding: '12px',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#34d399'
    }}>
      <div style={{ borderBottom: '1px solid #27272a', paddingBottom: '4px', marginBottom: '8px', color: '#71717a', fontWeight: 'bold' }}>
        TERMINAL (xterm.js widget)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
        {history.map((line, idx) => (
          <div key={idx} style={{ color: line.startsWith('$') ? '#d4d4d8' : '#34d399' }}>{line}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        <span style={{ color: '#d4d4d8' }}>$</span>
        <input 
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setHistory([...history, \`$ \${cmd}\`, \`Executed \${cmd} successfully.\`]);
              setCmd('');
            }
          }}
          style={{ flex: 1, backgroundColor: 'transparent', border: 'none', outline: 'none', color: '#ffffff', fontFamily: 'monospace', fontSize: '11px' }}
        />
      </div>
    </div>
  );
}
  `,

  "/src/vs/editor/common/model/textModel.ts": `
import React, { useState } from 'react';

export default function TextModel() {
  const [content, setContent] = useState('// Enter code here...\\nfunction init() {\\n  console.log("VS Code TextModel");\\n}');
  return (
    <div style={{ 
      padding: 15, 
      backgroundColor: '#18181b', 
      border: '1px solid #27272a', 
      borderRadius: 6, 
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <div style={{ color: '#60a5fa', fontSize: 12, marginBottom: 8, fontWeight: 'bold' }}>TextModel (Buffer Manager)</div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{
          width: '100%',
          height: 120,
          backgroundColor: '#09090b',
          color: '#d4d4d8',
          border: '1px solid #27272a',
          borderRadius: 4,
          padding: 8,
          fontSize: 11,
          fontFamily: 'monospace',
          outline: 'none',
          resize: 'none'
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#71717a', marginTop: 5 }}>
        <span>Length: {content.length} chars</span>
        <span>Lines: {content.split('\\n').length}</span>
      </div>
    </div>
  );
}
  `,

  "/src/vs/platform/instantiation/common/instantiationService.ts": `
import React from 'react';

export function InstantiationService() {
  return (
    <div style={{ 
      padding: 15, 
      backgroundColor: '#18181b', 
      border: '1px solid #27272a', 
      borderRadius: 6,
      fontSize: '12px'
    }}>
      <h4 style={{ color: '#c084fc', margin: '0 0 8px 0' }}>InstantiationService</h4>
      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0 0 10px 0' }}>
        VS Code's dependency injection container.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontFamily: 'monospace' }}>
        <div style={{ padding: 4, backgroundColor: '#09090b', color: '#34d399', borderRadius: 4 }}>✓ ServiceCollection registered</div>
        <div style={{ padding: 4, backgroundColor: '#09090b', color: '#34d399', borderRadius: 4 }}>✓ EditorService instanced</div>
        <div style={{ padding: 4, backgroundColor: '#09090b', color: '#34d399', borderRadius: 4 }}>✓ ConfigurationService injected</div>
      </div>
    </div>
  );
}
  `,

  "/src/vs/platform/configuration/common/configurationService.ts": `
import React from 'react';

export default function ConfigurationService() {
  return (
    <div style={{ 
      padding: 15, 
      backgroundColor: '#18181b', 
      border: '1px solid #27272a', 
      borderRadius: 6,
      fontSize: '12px'
    }}>
      <h4 style={{ color: '#2dd4bf', margin: '0 0 8px 0' }}>ConfigurationService</h4>
      <p style={{ fontSize: 11, color: '#a1a1aa', margin: '0' }}>
        Manages global/workspace preferences, watches setting files, and emits change events to workbench components.
      </p>
    </div>
  );
}
  `,

  "/src/vs/platform/files/node/watcher/nsfw/src/lib.rs": `// NSFW: Native Watcher Rust Bridge
use std::path::Path;
use std::sync::mpsc::channel;
use notify::{Watcher, RecursiveMode, RawEvent};

pub fn init_watcher<P: AsRef<Path>>(target_path: P) -> Result<(), String> {
    let (tx, rx) = channel();
    let mut watcher = notify::raw_watcher(tx).map_err(|e| e.to_string())?;
    
    watcher.watch(target_path, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    
    std::thread::spawn(move || {
        loop {
            match rx.recv() {
                Ok(RawEvent { path: Some(path), op: Ok(op), .. }) => {
                    println!("FS Event Alert: {:?} on {:?}", op, path);
                },
                Err(e) => println!("Error in native thread: {:?}", e),
                _ => {}
            }
        }
    });
    
    Ok(())
}`,

  "/src/vs/platform/files/node/watcher/nsfw/Cargo.toml": `[package]
name = "vscode-watcher-nsfw"
version = "1.85.0"
edition = "2021"
authors = ["Microsoft"]

[lib]
name = "watcher"
crate-type = ["cdylib"]

[dependencies]
notify = "5.0.0-pre.16"
libc = "0.2"`,

  "/build/lib/electron.py": `# Download and Validate Electron Binaries for VS Code
import os
import sys
import urllib.request
import hashlib
import zipfile

ELECTRON_VERSION = "27.1.3"

def get_electron_url():
    platform = sys.platform
    if platform == "darwin":
        return f"https://github.com/electron/electron/releases/download/v{ELECTRON_VERSION}/electron-v{ELECTRON_VERSION}-darwin-x64.zip"
    elif platform == "win32":
        return f"https://github.com/electron/electron/releases/download/v{ELECTRON_VERSION}/electron-v{ELECTRON_VERSION}-win32-x64.zip"
    return f"https://github.com/electron/electron/releases/download/v{ELECTRON_VERSION}/electron-v{ELECTRON_VERSION}-linux-x64.zip"

def download_and_extract(dest_dir):
    url = get_electron_url()
    zip_path = os.path.join(dest_dir, "electron.zip")
    print(f"Downloading Electron from {url}...")
    urllib.request.urlretrieve(url, zip_path)
    
    print("Extracting Electron binaries...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(dest_dir)
        
    os.remove(zip_path)
    print("Electron binary setup complete.")`,

  "/scripts/test.py": `# VS Code Integration Test Suite Launcher
import os
import sys
import subprocess
from lib import electron

def run_tests():
    print("Initializing test runtime context...")
    workspace_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    electron_dir = os.path.join(workspace_root, ".build", "electron")
    
    if not os.path.exists(electron_dir):
        os.makedirs(electron_dir)
        electron.download_and_extract(electron_dir)
        
    print("Launching integrations tests...")
    test_runner = os.path.join(workspace_root, "out", "test", "index.js")
    result = subprocess.run([sys.executable, test_runner], capture_output=True)
    
    if result.returncode == 0:
        print("All integration tests passed successfully.")
    else:
        print("Tests failed: " + result.stderr.decode())
        sys.exit(1)

if __name__ == "__main__":
    run_tests()`,

  "/src/vs/base/node/spdlog/spdlog.cc": `// High Performance Async Logging Node Bindings
#include <node.h>
#include <v8.h>
#include "spdlog/spdlog.h"
#include "spdlog/sinks/rotating_file_sink.h"

using namespace v8;

std::shared_ptr<spdlog::logger> logger;

void InitLogger(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    if (args.Length() < 2 || !args[0]->IsString() || !args[1]->IsNumber()) {
        isolate->ThrowException(Exception::TypeError(
            String::NewFromUtf8(isolate, "Invalid arguments. Expected: (path, max_size)").ToLocalChecked()
        ));
        return;
    }
    
    String::Utf8Value path(isolate, args[0]);
    int max_size = args[1]->Int32Value(isolate->GetCurrentContext()).ToChecked();
    
    try {
        logger = spdlog::rotating_logger_mt("spd_logger", *path, max_size, 3);
        logger->set_pattern("[%Y-%m-%d %H:%M:%S.%e] [%l] %v");
        args.GetReturnValue().Set(True(isolate));
    } catch (const spdlog::spdlog_ex& ex) {
        isolate->ThrowException(Exception::Error(
            String::NewFromUtf8(isolate, ex.what()).ToLocalChecked()
        ));
    }
}

void LogInfo(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    String::Utf8Value message(isolate, args[0]);
    if (logger) {
        logger->info(*message);
    }
}

void Initialize(Local<Object> exports) {
    NODE_SET_METHOD(exports, "init", InitLogger);
    NODE_SET_METHOD(exports, "info", LogInfo);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)`,

  "/src/vs/base/node/spdlog/binding.gyp": `{
  "targets": [
    {
      "target_name": "spdlog_bindings",
      "sources": [ "spdlog.cc" ],
      "include_dirs": [
        "<!(node -e \\"require('nan')\\")",
        "../../../../deps/spdlog/include"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        ["OS==\\"mac\\"", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES"
          }
        }]
      ]
    }
  ]
}`,

  "/src/vs/workbench/browser/media/style.css": `/* Global Theme Styles for VS Code Workbench */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #09090b;
}

.activity-bar {
  border-right: 1px solid #27272a;
}

.editor-tabs-container {
  background-color: #18181b;
  border-bottom: 1px solid #27272a;
}

.status-bar {
  background-color: #18181b;
  border-top: 1px solid #27272a;
}

.tab-active {
  background-color: #27272a;
  color: #ffffff;
}`,

  "/README.md": `# Visual Studio Code — CodeMapper Live Preview

This is the mock sandbox representation of the Visual Studio Code repository (\`microsoft/vscode\`).
It maps out dependency structures across multiple language paradigms:

1. **TypeScript/JavaScript**: Core UI elements (\`workbench.ts\`, \`editorPart.ts\`, \`terminalInstance.ts\`).
2. **Rust Backend Watcher**: Low-level FS watch bridge (\`lib.rs\`, \`Cargo.toml\`).
3. **Python Automation Tools**: Electron downloader and testing harnesses (\`test.py\`, \`electron.py\`).
4. **C++ Addons**: Native wrapper logs (\`spdlog.cc\`, \`binding.gyp\`).
5. **Theme Styling**: CSS style definitions (\`style.css\`).

Use **UI Mode** to visualize files instantly on the canvas nodes!`,

  "/package.json": `{
  "name": "vscode-core-demo",
  "version": "1.85.0",
  "description": "Mock package manifest for VS Code demo",
  "dependencies": {
    "react": "latest",
    "react-dom": "latest",
    "xterm": "latest"
  }
}`
};
