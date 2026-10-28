const { GoogleGenAI } = require('@google/genai');

/**
 * Intelligent content improvement service.
 * Supports Google Gemini API when GEMINI_API_KEY is configured,
 * with a high-quality heuristic fallback engine for offline or mock scenarios.
 */

const fallbackImprovement = ({ title, description, content, category }) => {
  // Enhanced Title
  const cleanedTitle = title.trim();
  const improvedTitle = cleanedTitle.startsWith('[Improved]')
    ? cleanedTitle
    : `Enhanced: ${cleanedTitle}`;

  // Enhanced Description
  const improvedDescription = `${description.trim()} — Refined for higher engagement, clarity, and thematic depth in ${category}.`;

  // Enhanced Content formatting and flow
  const paragraphs = content
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const improvedParagraphs = paragraphs.map((p, index) => {
    // Add professional transitions and polish
    if (index === 0) {
      return `### Overview\n${p}\n\nIn this piece, we explore the core perspectives shaping ${category}.`;
    }
    return p;
  });

  const improvedContent = [
    improvedParagraphs.join('\n\n'),
    `\n\n### Key Takeaways\n- Clear and structured narrative tailored for ${category}.\n- Enhanced readability and coherent thematic flow.\n- Designed for audience retention and impactful takeaway.`,
  ].join('');

  return {
    improvedTitle,
    improvedDescription,
    improvedContent,
    improvementSummary: 'Content structured with markdown subheadings, enhanced opening hook, and key takeaways (generated via local enhancement engine).',
    provider: 'local-enhancement-engine',
  };
};

const improveContentWithAI = async ({ title, description, content, category }) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_gemini_api_key_here') {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are an expert editorial writer and content strategist for Akatsuki's Draft platform.
Enhance and improve the following post while maintaining its original message and tone.
Category: ${category}
Original Title: ${title}
Original Description: ${description}
Original Content:
${content}

Please provide your response in valid JSON format with the following keys:
{
  "improvedTitle": "An engaging, refined title",
  "improvedDescription": "A concise, compelling 1-2 sentence summary",
  "improvedContent": "The enhanced, well-structured, formatted content with clear paragraphs and markdown formatting if appropriate",
  "improvementSummary": "A brief 1-line note of what was improved"
}
Output raw JSON only without markdown code blocks if possible, or inside a json code block.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text || '';
      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          improvedTitle: parsed.improvedTitle || `Enhanced: ${title}`,
          improvedDescription: parsed.improvedDescription || description,
          improvedContent: parsed.improvedContent || content,
          improvementSummary: parsed.improvementSummary || 'AI-improved phrasing, engagement, and structure.',
          provider: 'google-gemini',
        };
      }
    } catch (error) {
      console.warn(`[AI Service] Gemini call failed or key invalid (${error.message}). Falling back to local engine.`);
    }
  }

  // Graceful fallback if no API key or call failed
  return fallbackImprovement({ title, description, content, category });
};

module.exports = {
  improveContentWithAI,
};
