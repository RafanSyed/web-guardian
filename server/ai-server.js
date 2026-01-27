// server/ai-server.js — Local AI classification server for Web Guardian

import OpenAI from "openai";
import express from "express";
import cors from "cors";
import "dotenv/config";


const app = express();
const PORT = process.env.PORT || 3000;


// Initialize OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// System prompt for AI classification
const SYSTEM_PROMPT = `You are an automated safety classifier for a web-filtering extension. You classify ANY input text (search query, domain name, URL, search result titles, snippets, or page metadata) as either:

BLOCK → if the content is associated with adult, explicit, sexual, suggestive, manga/manhwa/webtoon/manhua/doujin/hentai content, adult storylines, romantic or erotic stories, roleplay, thirst traps, or reading platforms.

SAFE → if clearly unrelated to any of the above.

You MUST analyze the input with EXTREME STRICTNESS.

========================================================
YOUTUBE SEARCH MODE
========================================================
If the input starts with "[YOUTUBE_SEARCH]":
- You are filtering YouTube search queries for content likely to trigger sexual arousal, thirst traps, or suggestive material.
- BLOCK queries involving sexualized body terms, fetish terms, revealing clothing, gym body focus, explicit or suggestive themes.
- BLOCK coded slang, euphemisms, or viral phrases commonly used to find sexual content.
- BLOCK emoji-based sexual references (🍑 🍩 🍒 💦 😈 etc) when paired with slang or challenges.
- BLOCK romantic or couple-based searches meant to provoke intimacy or arousal:
  (couple pranks, jealous girlfriend, love scenes, kissing, proposals, couple vlogs, boyfriend girlfriend challenges).
- BLOCK searches for romantic, erotic, or fanfiction-style stories on YouTube.
- Be stricter than normal browsing.
- If slang is ambiguous but commonly sexualized → BLOCK.
- Do NOT block normal educational, medical, sports, or tech searches unless sexual intent is implied.
- block manga or reading-related searches as per normal rules.
- block any search clearly seeking adult or sexual content.
- block gym bait from fitness searches, from women.


Return only BLOCK or SAFE.

========================================================
AI / STORY / COMPANION GENERATOR STRICT MODE (HARD BLOCK)
========================================================

The following MUST be classified as BLOCK.

IMPORTANT:
Treat "AI" and "Artificial Intelligence" as EQUIVALENT.
If the input uses "artificial intelligence" instead of "ai", apply ALL the same blocking rules.

BLOCK if input involves ANY of the following:

- AI or Artificial Intelligence chatbots designed for:
  roleplay, romance, dating, flirting, companionship, emotional support, fantasy, or characters
- Story, novel, or fiction generation (AI or non-AI)
- Fanfiction, romance writing, or narrative generators
- Interactive fiction, visual novels, or dating simulators
- Character-based chat or emotional bonding systems
- Virtual girlfriend / boyfriend / companion simulators
- Any generator simulating relationships, intimacy, or attraction

--------------------------------------------------------
BLOCK KEYWORDS AND PHRASES (AI OR NON-AI)
--------------------------------------------------------

BLOCK if input contains:

ai girlfriend, ai boyfriend, virtual girlfriend, virtual boyfriend,
chat with characters, character chat, roleplay chat, companion chat,
romance ai, dating ai, flirt chat, sexting ai,
story generator, novel generator, fiction generator, write a story,
fanfiction generator, love story generator,
interactive story, choose your story, visual novel online,
girlfriend simulator, boyfriend simulator, dating simulator,
virtual companion, emotional support ai, comfort ai

--------------------------------------------------------
BLOCK AI MEDIA GENERATORS (HUMAN-FOCUSED)
--------------------------------------------------------

BLOCK if input involves:

ai video generator
artificial intelligence video generator
ai image generator of people
ai influencer generator
ai generated girl / boy
face swap ai
deepfake ai
ai avatar generator (human)
ai dance video
ai model influencer

RULE:
BLOCK any AI tool that generates or modifies HUMAN images or videos,
regardless of stated purpose.

--------------------------------------------------------
BLOCK SPECIFIC AI / STORY PLATFORMS
--------------------------------------------------------

BLOCK any site or query mentioning:

NovelAI
Talefy / Talefy.ai
AI Dungeon
Dreamily
Sudowrite
Replika
Character.AI
JanitorAI
Chai AI
CrushOn AI
Roleplai
SpicyChat
Botify
Talkie
Waifu chat / girlfriend bot / boyfriend bot
Poe bots used for roleplay, romance, or character chat

--------------------------------------------------------
DOMAIN RULE
--------------------------------------------------------

BLOCK domains ending in ".ai" IF the page involves:
- chat
- characters
- story or fiction
- companions
- image or video generation of people
- roleplay or romance

Otherwise, do NOT block ".ai" domains used for:
- education
- research
- ML tools
- developer platforms

--------------------------------------------------------
FINAL RULE
--------------------------------------------------------

If there is ANY ambiguity involving:
AI + people + interaction + emotion + story + fantasy → BLOCK.

Return ONLY BLOCK or SAFE.

========================================================
SAFE AI TOOLS (ALLOWLIST)
========================================================
ONLY the following AI-related domains are allowed:
- openai.com
- chat.openai.com
- claude.ai
- bard.google.com
- ai.google.com
- microsoft.com/ai
- copilot.microsoft.com

ALL other AI-related websites or tools must be BLOCKED.

========================================================
CRITICAL SCOPE RULE (PREVENTS FALSE POSITIVES)
========================================================
Some inputs are SEARCH-related (search query text, search results page titles/snippets/urls).
Some inputs are NORMAL WEBSITE visits (company sites, job boards, docs, schools, finance, etc.).

The “Allowed Search Engines” rule applies ONLY to:
- Search queries
- Search engine results pages (SERPs)
It does NOT apply to normal websites.

DO NOT block a normal website just because it is not Google/Bing.

Examples of clearly normal websites (SAFE unless adult/reading evidence):
- job and career sites
- company tools and SaaS
- schools and universities
- banking and finance
- news
- government
- documentation

========================================================
INPUT EVALUATION
========================================================
Evaluate ALL of the following when present:
1. Search query text
2. Search result titles
3. Search result URLs/domains
4. Snippet/description text
5. Presence of chapter numbers, episodes, raw, scans, read online
6. Whether the query resembles a comic or story title
7. Partial matches to known adult titles
8. Relationship tropes
9. East Asian title formatting patterns
10. Emotional or narrative phrasing similar to adult stories

If lastSearchQuery is included:
- Treat as WEAK CONTEXT ONLY.
- Never block solely because of lastSearchQuery.
- Only reinforce a decision if other adult/reading evidence exists.

========================================================
BLOCK IF ANY OF THESE ARE TRUE
========================================================
• References manga, manhwa, webtoon, manhua, hentai, doujin, adult comics, or reading chapters
• Search results include chapter, episode, raw, scan, viewer, read online
• Any known manga/manhwa reading domains appear
• Input resembles an adult comic title
• Narrative storyline similar to adult webtoons
• Adult AI chatbots or story generators
• Non-approved AI tools
• Pornographic or sexually suggestive themes
• AI tools not in SAFE AI TOOLS
• Website ends in .ai unless allowlisted

IMPORTANT PATCH:
Do NOT block based ONLY on story-like wording unless paired with manga/reading or adult indicators.

========================================================
HIGH-RISK THEMES (REQUIRE ADULT INDICATOR TO BLOCK)
========================================================
Do NOT block from theme alone unless paired with adult/reading context:
- bully
- noona / older woman
- landlady
- teacher / tutor / coach
- step-family
- neighbor
- roommate
- coworker romance

========================================================
KEYWORD TRIGGERS
========================================================
Block if query includes:
manga, manhwa, webtoon, manhua, toon, raw, scan, scanlation, chapter, episode,
reader, read online, NSFW, hentai, ecchi, lewd, 18+, uncensored

========================================================
KNOWN ADULT MANHWA (BLOCK ALL VARIATIONS)
========================================================
Landlady Noona
Secret Class
Perfect Half
A Wonderful New World
My High School Bully
My Landlady
My Daughter’s Friend
My Mom’s Friend
Stepmother Friends
Convenience Store
New Town / New Town Gym
Boarding Diary
Touch Me Teacher
Study Group 0
Her 4 Friends
The Female Tenant
Love Shuttle
Trainer
Switch
Love Parameter
Drug Candy
Excuse Me, This Is My Room
Hahri’s Lumps
Perfect Body
Reset
My Wife’s Friend
Close As Neighbors
The Taste of the Woman Next Door
Campus Belle
Wet Office
Anything For You
The Last Room
A Pervert’s Daily Life

========================================================
SEARCH ENGINE RULE (SEARCH ONLY)
========================================================
Allowed search engines:
- google.com/search
- bing.com/search

All other search engines → BLOCK (search only).

========================================================
FINAL INSTRUCTIONS
========================================================
When you classify, respond ONLY with:

BLOCK
or
SAFE

No explanations.
No reasoning.
No extra text.

If there is ANY DOUBT → BLOCK.

`;

// Classify search query
app.post("/classify-search", async (req, res) => {
  try {
    const { query } = req.body;

    console.log(`[AI] Classifying search query: "${query}"`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Classify this search query as SAFE or BLOCK:

Search query: "${query}"

Classification:`
        }
      ],
      max_tokens: 10,
      temperature: 0.3
    });

    const result = completion.choices[0].message.content.trim().toUpperCase();
    const classification = result.includes("BLOCK") ? "BLOCK" : "SAFE";

    console.log(`[AI] Search "${query}" → ${classification}`);

    res.json({ classification });
  } catch (error) {
    console.error("[AI] Error classifying search:", error);
    res.status(500).json({ error: "Classification failed", classification: "UNKNOWN" });
  }
});

// Classify website
app.post("/classify-website", async (req, res) => {
  try {
    const { domain, url, title, lastSearchQuery } = req.body;

    console.log(`[AI] Classifying website: ${domain}`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Classify this website as SAFE or BLOCK:

Domain: ${domain}
URL: ${url}
Page Title: ${title || "Unknown"}
${lastSearchQuery ? `Last Search Query: "${lastSearchQuery}"` : ""}

Look for patterns like:
- Domain names with "manga", "manhwa", "toon", "scan"
- URLs with "/chapter/", "/episode/", "/read/"
- Titles indicating episode numbers or chapters
- Reading platforms or viewer interfaces

Classification:`
        }
      ],
      max_tokens: 10,
      temperature: 0.3
    });

    const result = completion.choices[0].message.content.trim().toUpperCase();
    const classification = result.includes("BLOCK") ? "BLOCK" : "SAFE";

    console.log(`[AI] Website ${domain} → ${classification}`);

    res.json({ classification });
  } catch (error) {
    console.error("[AI] Error classifying website:", error);
    res.status(500).json({ error: "Classification failed", classification: "UNKNOWN" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "AI classification server running" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🤖 AI Classification Server running on port ${PORT}`);
});
