pub async fn check_vulnerabilities(
    ext_deps: &std::collections::HashMap<String, String>,
    is_flutter: bool,
) -> std::collections::HashMap<String, Vec<String>> {
    let mut vulnerabilities_map = std::collections::HashMap::new();

    if !ext_deps.is_empty() {
        let ecosystem = if is_flutter { "Pub" } else { "npm" };
        let mut queries = Vec::new();

        for (pkg, ver) in ext_deps {
            if !ver.is_empty() {
                queries.push(serde_json::json!({
                    "package": { "name": pkg, "ecosystem": ecosystem },
                    "version": ver
                }));
            }
        }

        if !queries.is_empty() {
            let req_body = serde_json::json!({ "queries": queries });
            let client = reqwest::Client::new();
            if let Ok(resp) = client
                .post("https://api.osv.dev/v1/querybatch")
                .json(&req_body)
                .send()
                .await
            {
                if let Ok(json_resp) = resp.json::<serde_json::Value>().await {
                    if let Some(results) = json_resp.get("results").and_then(|r| r.as_array()) {
                        let mut i = 0;
                        for (pkg, _ver) in ext_deps.iter().filter(|(_, v)| !v.is_empty()) {
                            if let Some(res) = results.get(i) {
                                if let Some(vulns) = res.get("vulns").and_then(|v| v.as_array()) {
                                    let mut v_list = Vec::new();
                                    for vuln in vulns {
                                        if let Some(id) = vuln.get("id").and_then(|i| i.as_str()) {
                                            v_list.push(id.to_string());
                                        }
                                    }
                                    if !v_list.is_empty() {
                                        vulnerabilities_map.insert(pkg.clone(), v_list);
                                    }
                                }
                            }
                            i += 1;
                        }
                    }
                }
            }
        }
    }

    vulnerabilities_map
}
