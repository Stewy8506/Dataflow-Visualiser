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
