// aiClassifier.ts — Communication layer between extension and AI server

const AI_SERVER_URL = "http://localhost:3000";

export type AIResult = "SAFE" | "BLOCK" | "UNKNOWN";

// Classify a search query using AI
export async function classifySearchQuery(query: string): Promise<AIResult> {
  try {
    console.log(`[AI Classifier] Sending search query to AI: "${query}"`);
    
    const response = await fetch(`${AI_SERVER_URL}/classify-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error(`[AI Classifier] Server error: ${response.status}`);
      return "UNKNOWN";
    }

    const data = await response.json();
    console.log(`[AI Classifier] Search query result: ${data.classification}`);
    return data.classification as AIResult;
  } catch (error) {
    console.error("[AI Classifier] Failed to classify search query:", error);
    // If AI server is down, fall back to UNKNOWN (rule engine will handle)
    return "UNKNOWN";
  }
}

// Classify a website using AI
export async function classifyWebsite(
  domain: string,
  url: string,
  title?: string,
  lastSearchQuery?: string
): Promise<AIResult> {
  try {
    console.log(`[AI Classifier] Sending website to AI: ${domain}`);
    
    const response = await fetch(`${AI_SERVER_URL}/classify-website`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain,
        url,
        title: title || "",
        lastSearchQuery: lastSearchQuery || "",
      }),
    });

    if (!response.ok) {
      console.error(`[AI Classifier] Server error: ${response.status}`);
      return "UNKNOWN";
    }

    const data = await response.json();
    console.log(`[AI Classifier] Website result: ${data.classification}`);
    return data.classification as AIResult;
  } catch (error) {
    console.error("[AI Classifier] Failed to classify website:", error);
    // If AI server is down, fall back to UNKNOWN
    return "UNKNOWN";
  }
}

// Check if AI server is running
export async function checkAIServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AI_SERVER_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}