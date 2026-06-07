use crate::parser::GraphData;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
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

#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessageContent,
}

#[derive(Deserialize)]
struct OpenAiMessageContent {
    content: String,
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

async fn call_llm(
    ai_provider: &str,
    api_key: &str,
    model: &str,
    local_base_url: &str,
    prompt: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    if ai_provider == "local" {
        let url = format!("{}/chat/completions", local_base_url);
        let request_body = OpenAiRequest {
            model: model.to_string(),
            messages: vec![OpenAiMessage {
                role: "user".to_string(),
                content: prompt.to_string(),
            }],
        };

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let response_text = response.text().await.map_err(|e| e.to_string())?;
        let openai_response: OpenAiResponse =
            serde_json::from_str(&response_text).map_err(|e| format!("Parse Error: {}\nResponse: {}", e, response_text))?;

        if let Some(choice) = openai_response.choices.first() {
            Ok(choice.message.content.clone())
        } else {
            Err("Empty response from local AI".to_string())
        }
    } else {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
            model, api_key
        );

        let request_body = GeminiRequest {
            contents: vec![GeminiRequestContent {
                parts: vec![GeminiRequestPart {
                    text: prompt.to_string(),
                }],
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
            serde_json::from_str(&response_text).map_err(|e| format!("Parse Error: {}\nResponse: {}", e, response_text))?;

        let text = gemini_response
            .candidates
            .first()
            .and_then(|c| c.content.parts.first())
            .map(|p| p.text.trim().to_string())
            .ok_or("Empty response from AI")?;

        Ok(text)
    }
}

fn read_bounded_file(path: &Path, max_bytes: usize) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let clipped = if bytes.len() > max_bytes {
        &bytes[..max_bytes]
    } else {
        &bytes
    };
    let mut content = String::from_utf8_lossy(clipped).to_string();
    if bytes.len() > max_bytes {
        content.push_str("\n\n/* content truncated */");
    }
    Ok(content)
}

fn extract_json(text: &str) -> &str {
    if let Some(start) = text.find("```json") {
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
    }
}

#[tauri::command]
pub async fn enrich_graph_with_ai(
    window: Window,
    graph_data: GraphData,
    api_key: String,
    model: String,
    ai_provider: String,
    local_base_url: String,
) -> Result<(), String> {
    if ai_provider == "gemini" && api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    tauri::async_runtime::spawn(async move {
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

            if let Ok(response_text) = call_llm(&ai_provider, &api_key, &model, &local_base_url, &prompt).await {
                let json_str = extract_json(&response_text).trim();
                if let Ok(ai_result) = serde_json::from_str::<AiResult>(json_str) {
                    let _ = window.emit("ai_nodes_enriched", &ai_result.nodes);
                } else {
                    eprintln!("Failed to parse AI JSON result: {}", json_str);
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
    workspace_path: String,
    target_path: String,
    new_name: String,
    symbol_name: Option<String>,
    api_key: String,
    model: String,
    affected_files: Vec<String>,
    ai_provider: String,
    local_base_url: String,
) -> Result<Vec<RefactorFileUpdate>, String> {
    if ai_provider == "gemini" && api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let safe_target = crate::security::ensure_path_in_workspace(&workspace_path, &target_path)?;

    let mut prompt = format!(
        "You are an expert refactoring assistant. We are renaming a file or symbol.\n\
        Target File: {}\n\
        New Name: {}\n",
        safe_target.display(), new_name
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
        let safe_path = crate::security::ensure_path_in_workspace(&workspace_path, file_path)?;
        prompt.push_str(&format!("File Path: {}\n", safe_path.display()));
        prompt.push_str("Content:\n```\n");
        if let Ok(content) = read_bounded_file(&safe_path, 120_000) {
            prompt.push_str(&content);
        }
        prompt.push_str("\n```\n\n");
    }

    let response_text = call_llm(&ai_provider, &api_key, &model, &local_base_url, &prompt).await?;
    
    let json_str = extract_json(&response_text).trim();
    let ai_result: AiRefactorResult = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(ai_result.updates)
}

#[tauri::command]
pub async fn apply_ai_refactor(
    workspace_path: String,
    updates: Vec<RefactorFileUpdate>,
) -> Result<(), String> {
    for update in updates {
        let safe_path = crate::security::ensure_path_in_workspace(&workspace_path, &update.path)?;
        if let Err(e) = fs::write(&safe_path, &update.new_content) {
            return Err(format!("Failed to write file {}: {}", update.path, e));
        }
    }
    Ok(())
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

#[derive(Serialize)]
struct GeminiChatRequest {
    contents: Vec<GeminiChatContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GenerationConfig,
}

#[tauri::command]
pub async fn ask_assistant(
    history: Vec<ChatMessage>,
    workspace_path: Option<String>,
    file_path: Option<String>,
    api_key: String,
    model: String,
    ai_provider: String,
    local_base_url: String,
) -> Result<String, String> {
    if ai_provider == "gemini" && api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let file_context = match (workspace_path.as_deref(), file_path.as_deref()) {
        (Some(workspace), Some(path)) => {
            let safe_path = crate::security::ensure_path_in_workspace(workspace, path)?;
            Some(read_bounded_file(&safe_path, 80_000)?)
        }
        _ => None,
    };

    let client = reqwest::Client::new();

    if ai_provider == "local" {
        let url = format!("{}/chat/completions", local_base_url);
        let mut messages = Vec::new();
        
        for msg in history {
            messages.push(OpenAiMessage {
                role: msg.role,
                content: msg.text,
            });
        }

        if let Some(ctx) = file_context {
            if let Some(last) = messages.last_mut() {
                if last.role == "user" {
                    let current_text = last.content.clone();
                    last.content = format!("{}\n\nContext:\n```\n{}\n```", current_text, ctx);
                }
            }
        }

        let request_body = OpenAiRequest {
            model: model.to_string(),
            messages,
        };

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let response_text = response.text().await.map_err(|e| e.to_string())?;
        let openai_response: OpenAiResponse =
            serde_json::from_str(&response_text).map_err(|e| format!("Parse Error: {}\nResponse: {}", e, response_text))?;

        if let Some(choice) = openai_response.choices.first() {
            Ok(choice.message.content.clone())
        } else {
            Err("Empty response from local AI".to_string())
        }
    } else {
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
}
