use crate::parser::GraphData;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{Emitter, Window};

#[derive(Serialize, Deserialize)]
struct GeminiRequestPart {
    text: String,
}

#[derive(Serialize, Deserialize)]
struct GeminiRequestContent {
    parts: Vec<GeminiRequestPart>,
}

#[derive(Serialize, Deserialize)]
struct GenerationConfig {
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Serialize, Deserialize)]
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

#[derive(Serialize, Deserialize)]
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

// OpenAI structures
#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
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

// Anthropic structures
#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    messages: Vec<AnthropicMessage>,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContentPart>,
}

#[derive(Deserialize)]
struct AnthropicContentPart {
    #[serde(rename = "type")]
    part_type: String,
    text: String,
}

// Cohere structures
#[derive(Serialize)]
struct CohereMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct CohereRequest {
    model: String,
    messages: Vec<CohereMessage>,
}

#[derive(Deserialize)]
struct CohereResponse {
    message: CohereResponseMessage,
}

#[derive(Deserialize)]
struct CohereResponseMessage {
    content: Vec<CohereResponseContent>,
}

#[derive(Deserialize)]
struct CohereResponseContent {
    text: String,
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

async fn call_llm_core(
    ai_provider: &str,
    api_key: &str,
    model: &str,
    local_base_url: &str,
    messages: Vec<ChatMessage>,
    temperature: Option<f32>,
    response_json_mime: bool,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    match ai_provider {
        "local" | "openai" | "groq" | "deepseek" | "openrouter" => {
            let url = match ai_provider {
                "local" => format!("{}/chat/completions", local_base_url),
                "openai" => "https://api.openai.com/v1/chat/completions".to_string(),
                "groq" => "https://api.groq.com/openai/v1/chat/completions".to_string(),
                "deepseek" => "https://api.deepseek.com/v1/chat/completions".to_string(),
                "openrouter" => "https://openrouter.ai/api/v1/chat/completions".to_string(),
                _ => unreachable!(),
            };

            let mut request_messages = Vec::new();
            for msg in messages {
                request_messages.push(OpenAiMessage {
                    role: if msg.role == "assistant" || msg.role == "model" {
                        "assistant".to_string()
                    } else {
                        "user".to_string()
                    },
                    content: msg.text,
                });
            }

            let request_body = OpenAiRequest {
                model: model.to_string(),
                messages: request_messages,
                temperature,
            };

            let mut req = client.post(&url).header("Content-Type", "application/json");
            if ai_provider != "local" || !api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", api_key));
            }

            let response = req.json(&request_body).send().await.map_err(|e| e.to_string())?;
            let response_text = response.text().await.map_err(|e| e.to_string())?;
            
            let openai_response: OpenAiResponse = serde_json::from_str(&response_text)
                .map_err(|e| format!("Parse Error: {}\nResponse: {}", e, response_text))?;

            if let Some(choice) = openai_response.choices.first() {
                Ok(choice.message.content.clone())
            } else {
                Err("Empty response from OpenAI compatible LLM".to_string())
            }
        }
        "anthropic" => {
            let url = "https://api.anthropic.com/v1/messages";
            let mut request_messages = Vec::new();
            for msg in messages {
                request_messages.push(AnthropicMessage {
                    role: if msg.role == "assistant" || msg.role == "model" {
                        "assistant".to_string()
                    } else {
                        "user".to_string()
                    },
                    content: msg.text,
                });
            }

            let request_body = AnthropicRequest {
                model: model.to_string(),
                messages: request_messages,
                max_tokens: 4096,
                temperature,
            };

            let response = client
                .post(url)
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let response_text = response.text().await.map_err(|e| e.to_string())?;
            let anthropic_response: AnthropicResponse = serde_json::from_str(&response_text)
                .map_err(|e| format!("Parse Error: {}\nResponse: {}", e, response_text))?;

            if let Some(part) = anthropic_response.content.first() {
                Ok(part.text.clone())
            } else {
                Err("Empty response from Anthropic LLM".to_string())
            }
        }
        "cohere" => {
            let url = "https://api.cohere.com/v2/chat";
            let mut request_messages = Vec::new();
            for msg in messages {
                request_messages.push(CohereMessage {
                    role: if msg.role == "assistant" || msg.role == "model" {
                        "assistant".to_string()
                    } else {
                        "user".to_string()
                    },
                    content: msg.text,
                });
            }

            let request_body = CohereRequest {
                model: model.to_string(),
                messages: request_messages,
            };

            let response = client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let response_text = response.text().await.map_err(|e| e.to_string())?;
            let cohere_response: CohereResponse = serde_json::from_str(&response_text)
                .map_err(|e| format!("Parse Error: {}\nResponse: {}", e, response_text))?;

            if let Some(part) = cohere_response.message.content.first() {
                Ok(part.text.clone())
            } else {
                Err("Empty response from Cohere LLM".to_string())
            }
        }
        _ => {
            // Default to Gemini
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
                model, api_key
            );

            let mut contents = Vec::new();
            for msg in messages {
                contents.push(GeminiChatContent {
                    role: if msg.role == "assistant" || msg.role == "model" {
                        "model".to_string()
                    } else {
                        "user".to_string()
                    },
                    parts: vec![GeminiRequestPart { text: msg.text }],
                });
            }

            let request_body = GeminiChatRequest {
                contents,
                generation_config: GenerationConfig {
                    response_mime_type: if response_json_mime {
                        "application/json".to_string()
                    } else {
                        "text/plain".to_string()
                    },
                    temperature,
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
            let gemini_response: GeminiResponse = serde_json::from_str(&response_text)
                .map_err(|e| format!("Parse Error: {}\nResponse: {}", e, response_text))?;

            let text = gemini_response
                .candidates
                .first()
                .and_then(|c| c.content.parts.first())
                .map(|p| p.text.trim().to_string())
                .ok_or("Empty response from Gemini")?;

            Ok(text)
        }
    }
}

async fn call_llm(
    ai_provider: &str,
    api_key: &str,
    model: &str,
    local_base_url: &str,
    prompt: &str,
    temperature: Option<f32>,
) -> Result<String, String> {
    call_llm_core(
        ai_provider,
        api_key,
        model,
        local_base_url,
        vec![ChatMessage {
            role: "user".to_string(),
            text: prompt.to_string(),
        }],
        temperature,
        true,
    )
    .await
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
    temperature: Option<f32>,
    custom_prompt: Option<String>,
) -> Result<(), String> {
    if ai_provider != "local" && api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    tauri::async_runtime::spawn(async move {
        let chunk_size = 10;
        let nodes = graph_data.nodes.clone();

        for chunk in nodes.chunks(chunk_size) {
            let mut prompt = match &custom_prompt {
                Some(p) if !p.is_empty() => format!("{}\n\n", p),
                _ => String::from(
                    "You are an expert software architect. Analyze the provided codebase files and group them into semantic domains.\n\
                    Also, provide a short 1-2 sentence summary for each file.\n\n"
                )
            };
            prompt.push_str(
                "Return the result as a JSON object with the following schema:\n\
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

            if let Ok(response_text) = call_llm(
                &ai_provider,
                &api_key,
                &model,
                &local_base_url,
                &prompt,
                temperature,
            )
            .await
            {
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
    if ai_provider != "local" && api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let safe_target = crate::security::ensure_path_in_workspace(&workspace_path, &target_path)?;

    let mut prompt = format!(
        "You are an expert refactoring assistant. We are renaming a file or symbol.\n\
        Target File: {}\n\
        New Name: {}\n",
        safe_target.display(),
        new_name
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

    let response_text = call_llm(
        &ai_provider,
        &api_key,
        &model,
        &local_base_url,
        &prompt,
        None,
    )
    .await?;

    let json_str = extract_json(&response_text).trim();
    let ai_result: AiRefactorResult =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse JSON: {}", e))?;

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

#[derive(Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub text: String,
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
    temperature: Option<f32>,
) -> Result<String, String> {
    if ai_provider != "local" && api_key.is_empty() {
        return Err("API key is required".to_string());
    }

    let file_context = match (workspace_path.as_deref(), file_path.as_deref()) {
        (Some(workspace), Some(path)) => {
            let safe_path = crate::security::ensure_path_in_workspace(workspace, path)?;
            Some(read_bounded_file(&safe_path, 80_000)?)
        }
        _ => None,
    };

    let mut messages = history;

    if let Some(ctx) = file_context {
        if let Some(last) = messages.last_mut() {
            if last.role == "user" {
                let current_text = last.text.clone();
                last.text = format!("{}\n\nContext:\n```\n{}\n```", current_text, ctx);
            }
        }
    }

    call_llm_core(
        &ai_provider,
        &api_key,
        &model,
        &local_base_url,
        messages,
        temperature,
        false,
    )
    .await
}
