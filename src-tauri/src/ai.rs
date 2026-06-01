use crate::parser::GraphData;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{Emitter, Window};

#[derive(Serialize)]
struct GeminiRequestPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiRequestContent {
    parts: Vec<GeminiRequestPart>,
}

#[derive(Serialize)]
struct GenerationConfig {
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiRequestContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[derive(Deserialize)]
struct GeminiResponseCandidate {
    content: GeminiResponseContent,
}

#[derive(Deserialize)]
struct GeminiResponseContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiResponseCandidate>,
}

#[derive(Serialize, Deserialize, Clone)]
struct AiNodeResult {
    id: String,
    semantic_group: String,
    summary: String,
}

#[derive(Deserialize)]
struct AiResult {
    nodes: Vec<AiNodeResult>,
}

#[tauri::command]
pub async fn enrich_graph_with_ai(
    window: Window,
    graph_data: GraphData,
    api_key: String,
    model: String,
) -> Result<(), String> {
    if api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let chunk_size = 10;

        let nodes = graph_data.nodes.clone();

        for chunk in nodes.chunks(chunk_size) {
            let mut prompt = String::from(
                "You are an expert software architect. Analyze the provided codebase files and group them into semantic domains.\n\
                Also, provide a short 1-2 sentence summary for each file.\n\n\
                Return the result as a JSON object with the following schema:\n\
                {\n\
                  \"nodes\": [\n\
                    {\n\
                      \"id\": \"file id (exact string match from input)\",\n\
                      \"semantic_group\": \"A short category name (e.g., 'Authentication', 'UI Components', 'Database', 'API Routes')\",\n\
                      \"summary\": \"Short explanation of what the file does\"\n\
                    }\n\
                  ]\n\
                }\n\n\
                Only return the JSON. Do not include markdown formatting or explanations.\n\n\
                Input Nodes:\n",
            );

            for node in chunk {
                prompt.push_str(&format!("File ID: {}\n", node.id));
                prompt.push_str(&format!("File Name: {}\n", node.label));
                prompt.push_str("Content:\n```\n");
                if let Ok(content) = fs::read_to_string(&node.id) {
                    let truncated = content.lines().take(50).collect::<Vec<_>>().join("\n");
                    prompt.push_str(&truncated);
                } else {
                    prompt.push_str("// Could not read file content");
                }
                prompt.push_str("\n```\n\n");
            }

            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
                model, api_key
            );

            let request_body = GeminiRequest {
                contents: vec![GeminiRequestContent {
                    parts: vec![GeminiRequestPart { text: prompt }],
                }],
                generation_config: GenerationConfig {
                    response_mime_type: "application/json".to_string(),
                },
            };

            let response = client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await;

            if let Ok(resp) = response {
                if let Ok(response_text) = resp.text().await {
                    if let Ok(gemini_response) =
                        serde_json::from_str::<GeminiResponse>(&response_text)
                    {
                        if let Some(candidate) = gemini_response.candidates.first() {
                            if let Some(part) = candidate.content.parts.first() {
                                let text = part.text.trim();

                                let json_str = if let Some(start) = text.find("```json") {
                                    if let Some(end) = text[start + 7..].find("```") {
                                        &text[start + 7..start + 7 + end]
                                    } else {
                                        &text[start + 7..]
                                    }
                                } else if let Some(start) = text.find('{') {
                                    if let Some(end) = text.rfind('}') {
                                        &text[start..=end]
                                    } else {
                                        text
                                    }
                                } else {
                                    text
                                };

                                let json_str = json_str.trim();

                                if let Ok(ai_result) = serde_json::from_str::<AiResult>(json_str) {
                                    let _ = window.emit("ai_nodes_enriched", &ai_result.nodes);
                                } else {
                                    eprintln!("Failed to parse AI JSON result: {}", json_str);
                                }
                            }
                        }
                    } else {
                        eprintln!("Failed to parse Gemini response: {}", response_text);
                    }
                }
            }
        }
        let _ = window.emit("ai_enrichment_complete", ());
    });

    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct RefactorFileUpdate {
    pub path: String,
    pub new_content: String,
}

#[derive(Deserialize)]
struct AiRefactorResult {
    updates: Vec<RefactorFileUpdate>,
}

#[tauri::command]
pub async fn execute_ai_refactor(
    _workspace_path: String,
    target_path: String,
    new_name: String,
    symbol_name: Option<String>,
    api_key: String,
    model: String,
    affected_files: Vec<String>,
) -> Result<Vec<RefactorFileUpdate>, String> {
    if api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let client = reqwest::Client::new();
    let mut prompt = format!(
        "You are an expert refactoring assistant. We are renaming a file or symbol.\n\
        Target File: {}\n\
        New Name: {}\n",
        target_path, new_name
    );

    if let Some(sym) = &symbol_name {
        prompt.push_str(&format!("Symbol to rename: {}\n", sym));
    }

    prompt.push_str(
        "\nProvide the updated full content for each of the following dependent files.\n\
        Return the result as a JSON object with the following schema:\n\
        {\n\
          \"updates\": [\n\
            {\n\
              \"path\": \"file path exactly as provided\",\n\
              \"new_content\": \"the complete updated file content\"\n\
            }\n\
          ]\n\
        }\n\
        Only return the JSON. Do not use markdown blocks.\n\n\
        Dependent Files:\n",
    );

    for file_path in &affected_files {
        prompt.push_str(&format!("File Path: {}\n", file_path));
        prompt.push_str("Content:\n```\n");
        if let Ok(content) = fs::read_to_string(file_path) {
            prompt.push_str(&content);
        }
        prompt.push_str("\n```\n\n");
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
        model, api_key
    );

    let request_body = GeminiRequest {
        contents: vec![GeminiRequestContent {
            parts: vec![GeminiRequestPart { text: prompt }],
        }],
        generation_config: GenerationConfig {
            response_mime_type: "application/json".to_string(),
        },
    };

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let response_text = response.text().await.map_err(|e| e.to_string())?;

    let gemini_response: GeminiResponse =
        serde_json::from_str(&response_text).map_err(|e| e.to_string())?;
    let text = gemini_response
        .candidates
        .first()
        .and_then(|c| c.content.parts.first())
        .map(|p| p.text.trim())
        .ok_or("Empty response from AI")?;

    let json_str = if let Some(start) = text.find("```json") {
        if let Some(end) = text[start + 7..].find("```") {
            &text[start + 7..start + 7 + end]
        } else {
            &text[start + 7..]
        }
    } else if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            &text[start..=end]
        } else {
            text
        }
    } else {
        text
    };

    let ai_result: AiRefactorResult = serde_json::from_str(json_str.trim())
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Apply the updates to the file system
    for update in &ai_result.updates {
        if let Err(e) = fs::write(&update.path, &update.new_content) {
            return Err(format!("Failed to write file {}: {}", update.path, e));
        }
    }

    Ok(ai_result.updates)
}

#[derive(Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub text: String,
}

#[derive(Serialize)]
struct GeminiChatContent {
    role: String,
    parts: Vec<GeminiRequestPart>,
}

#[tauri::command]
pub async fn ask_assistant(
    history: Vec<ChatMessage>,
    file_context: Option<String>,
    api_key: String,
    model: String,
) -> Result<String, String> {
    if api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let client = reqwest::Client::new();
    let mut contents = Vec::new();

    for msg in history {
        contents.push(GeminiChatContent {
            role: if msg.role == "assistant" { "model".to_string() } else { "user".to_string() },
            parts: vec![GeminiRequestPart { text: msg.text }],
        });
    }

    if let Some(ctx) = file_context {
        if let Some(last) = contents.last_mut() {
            if last.role == "user" {
                let current_text = last.parts[0].text.clone();
                last.parts[0].text = format!("{}\n\nContext:\n```\n{}\n```", current_text, ctx);
            }
        }
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
        model, api_key
    );

    #[derive(Serialize)]
    struct GeminiChatRequest {
        contents: Vec<GeminiChatContent>,
        #[serde(rename = "generationConfig")]
        generation_config: GenerationConfig,
    }

    let request_body = GeminiChatRequest {
        contents,
        generation_config: GenerationConfig {
            response_mime_type: "text/plain".to_string(),
        },
    };

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let response_text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    let gemini_response: GeminiResponse =
        serde_json::from_str(&response_text).map_err(|e| format!("Failed to parse JSON: {}\nResponse was: {}", e, response_text))?;
    
    let text = gemini_response
        .candidates
        .first()
        .and_then(|c| c.content.parts.first())
        .map(|p| p.text.trim().to_string())
        .ok_or("Empty response from AI")?;

    Ok(text)
}
