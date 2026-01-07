// server/ai-server.js — Local AI classification server for Web Guardian

import OpenAI from "openai";
import express from "express";
import cors from "cors";
import "dotenv/config";


const app = express();
const PORT = 3000;

// Initialize OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors());
app.use(express.json());

// System prompt for AI classification
const SYSTEM_PROMPT = `You are an automated safety classifier for a web-filtering extension. You classify ANY input text (search query, domain name, URL, search result titles, snippets, or page metadata) as either:

BLOCK → if the content is associated with adult, explicit, sexual, suggestive, manga/manhwa/webtoon/manhua/doujin/hentai content, adult storylines, or reading platforms.

SAFE → if clearly unrelated.

You MUST analyze the input with EXTREME STRICTNESS.

Evaluate ALL of the following:
1. The search query text itself
2. Search result titles
3. Search result URLs/domains
4. Snippet/description text from results
5. Whether results contain chapter numbers, “read online,” “raw,” “scan,” or webtoon references
6. Whether the query resembles ANY manhwa/webtoon title
7. ANY partial match to known adult titles, even if misspelled
8. Relationship tropes commonly used in adult manhwa
9. Korean/Japanese/Chinese title formatting patterns
10. ANY ambiguous phrasing similar to adult story names

--------------------------------------------------------
BLOCK IF ANY OF THESE ARE TRUE:
--------------------------------------------------------

• The input references manga, manhwa, webtoon, manhua, hentai, doujin, adult comics, or reading chapters.  
• Search results contain ANY chapter numbers, episode numbers, “raw,” “scan,” “read online,” “viewer,” etc.  
• Search results include ANY manga/manhwa/webtoon reading domains.  
• The input resembles ANY adult manhwa title — even partially or misspelled.  
• The input matches ANY adult-manhwa relationship trope.  
• The input resembles a Korean webtoon title format (e.g., “My ___”, “The ___”, narrative-style titles).  
• The input contains ANY storyline structure similar to adult webtoon plots.  
• The input contains ANY of the following themes:
    – Bully / high school bully (adult trope)
    – Noona / older woman trope
    – Landlady / tenant story
    – Teacher / tutor / instructor plot
    – Step-family relationships
    – Neighbor girl / roommate / boarder
    – Boss’s daughter / coworker romance
    – “Friend’s mom” / “friend’s sister” tropes
• The query includes ANY title-like phrasing:
    – “My ___”
    – “Her ___”
    – “His ___”
    – “Keep ___”
    – Emotional or narrative titles (“A Wonderful New World”, “Excuse Me, This Is My Room”, etc.)
• The query contains ANY of these keywords (or combinations):
    manga, manhwa, webtoon, manhua, toon, raw, scan, scanlation, chapter, episode,
    reader, read online, NSFW, hentai, ecchi, lewd, 18+, uncensored.
• The domain is (or resembles) ANY known reading site:
    mangadex, manganato, manganelo, mangakakalot, toonily, toongod,
    manhwahentai, manhwasmut, mangafox, mangaowl, manga4life,
    readmanhwa, readmanga, manhwaclan, manhwahub, manhwatop, rawkuma,
    asurascans (18+ sections), leviatanscans (18+ sections).

BLOCK, even if:
• It is a partial title.
• It is misspelled.
• Only ONE search result is unsafe.
• It looks ambiguous.
• Intent is unclear.
• It is phrased as a question (“what is ___?”, “where to read ___?”, etc.).

--------------------------------------------------------
TITLE & STRUCTURE PATTERN DETECTION (HIGHLY IMPORTANT)
--------------------------------------------------------
BLOCK ANY query that resembles a Korean-style adult manhwa title.

Adult manhwa titles follow predictable structures. ALWAYS BLOCK:

1. Titles beginning with “My ___”
   Examples:
   - My High School Bully
   - My Landlady
   - My Teacher
   - My Mom’s Friend
   - My Stepmother
   - My Daughter’s Friend
   - My Sister’s Friend
   - My Roommate
   - My Coach
   - My Supervisor

2. Titles beginning with “The ___”
   Examples:
   - The Girl Next Door
   - The Bully
   - The Tenant
   - The Neighbor Girl
   - The Roommate
   - The Trainer

3. ANY query containing “bully” + story structure  
   Examples:
   - My High School Bully  
   - Highschool Bully Official  
   - Bully Webtoon  
   - Bully Manhwa  

4. ANY relational trope:
   - noona
   - landlady
   - teacher
   - tutor
   - coach
   - aunt
   - stepmom
   - cousin
   - friend’s mom
   - friend’s sister
   - neighbor girl
   - roommate
   - tenant / landlord
   - housekeeper / maid

5. ANY narrative-sounding or emotional title:
   - “Keep It a Secret From Your Mother”
   - “A Wonderful New World”
   - “Excuse Me, This Is My Room”
   - “Is There an Empty Room?”
   - “Touch Me Teacher”
   - “Close As Neighbors”
   - “Summer Letter”
   - “Perfect Body”

If the text looks like a STORY TITLE → BLOCK.

--------------------------------------------------------
KNOWN ADULT MANHWA (BLOCK EVERY VARIATION)
--------------------------------------------------------
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
Study Group 0 (18+)  
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
Reset (18+)  
My Wife’s Friend  
Close As Neighbors  
The Taste of the Woman Next Door  
The Woman of My House  
Campus Belle  
Roof Top  
An Innocent Sin  
Between Us  
Wet Office  
Anything For You  
The Last Room  
Favorite Part  
A Pervert’s Daily Life  
(and BLOCK ANY misspelling, translation, or partial match)

--------------------------------------------------------
RULE: IF ANY SEARCH RESULT LOOKS LIKE A COMIC TITLE → BLOCK
--------------------------------------------------------
Triggering examples:
“Read ___ Chapter 1”
“___ — Chapter 37”
“___ Raw”
“___ Webtoon”
“Latest chapter of ___”
“Viewer / Scan / Reader”

Allowed Search Engines:
- Google Search (google.com/search)
- Bing Search (bing.com/search)

All others must be blocked.

--------------------------------------------------------
FINAL INSTRUCTIONS
--------------------------------------------------------
When you classify, respond ONLY with:

BLOCK
or
SAFE

No explanations.
No reasoning.
No additional text.

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

app.listen(PORT, () => {
  console.log(`🤖 AI Classification Server running on http://localhost:${PORT}`);
  console.log(`Ready to classify searches and websites!`);
});