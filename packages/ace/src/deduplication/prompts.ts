/**
 * Prompts and report generation for skill deduplication.
 */

import type { Skill } from "../skillbook";

const SIMILARITY_REPORT_HEADER = `
## Similar Skills Detected

The following skill pairs have high semantic similarity and may need consolidation.
For each pair, you can decide to:
- **MERGE**: Combine into a single improved skill (provide merged_content and keep_id)
- **DELETE**: Remove one as redundant (specify skill_id to delete)
- **KEEP**: Keep both separate if they serve different purposes (explain differentiation)
- **UPDATE**: Refine one skill's content to clarify the difference (provide new_content)

`;

const PAIR_TEMPLATE = `### Pair {index}: {similarity} similar
**Skill A** [{id_a}] (helpful={helpful_a}, harmful={harmful_a})
> {content_a}

**Skill B** [{id_b}] (helpful={helpful_b}, harmful={harmful_b})
> {content_b}

`;

export function generateSimilarityReport(
  similarPairs: [Skill, Skill, number][]
): string {
  /**
   * Generate a human-readable similarity report for the SkillManager.
   *
   * Args:
   *   similarPairs: List of [skill_a, skill_b, similarity_score] tuples
   *
   * Returns:
   *   Formatted report string to include in SkillManager prompt
   */
  if (!similarPairs || similarPairs.length === 0) {
    return "";
  }

  const parts: string[] = [SIMILARITY_REPORT_HEADER];

  for (let i = 0; i < similarPairs.length; i++) {
    const [skillA, skillB, similarity] = similarPairs[i];
    const formattedSimilarity = `${Math.round(similarity * 100)}%`;

    let pairText = PAIR_TEMPLATE;
    pairText = pairText.replace("{index}", (i + 1).toString());
    pairText = pairText.replace("{similarity}", formattedSimilarity);
    pairText = pairText.replace("{id_a}", skillA.id);
    pairText = pairText.replace("{helpful_a}", skillA.helpful.toString());
    pairText = pairText.replace("{harmful_a}", skillA.harmful.toString());
    pairText = pairText.replace("{content_a}", skillA.content);
    pairText = pairText.replace("{id_b}", skillB.id);
    pairText = pairText.replace("{helpful_b}", skillB.helpful.toString());
    pairText = pairText.replace("{harmful_b}", skillB.harmful.toString());
    pairText = pairText.replace("{content_b}", skillB.content);

    parts.push(pairText);
  }

  parts.push(`
## Consolidation Operations Format

Include consolidation operations in your response under a \`consolidation_operations\` key.
Each operation should have a \`type\` field and relevant fields for that type:

\`\`\`json
{
  "consolidation_operations": [
    {
      "type": "MERGE",
      "source_ids": ["skill-id-1", "skill-id-2"],
      "keep_id": "skill-id-1",
      "merged_content": "Improved combined strategy text",
      "reasoning": "Why merging improves the skillbook"
    },
    {
      "type": "DELETE",
      "skill_id": "skill-id-to-remove",
      "reasoning": "Why this skill is redundant"
    },
    {
      "type": "KEEP",
      "skill_ids": ["skill-id-1", "skill-id-2"],
      "differentiation": "How they differ in purpose",
      "reasoning": "Why both are needed"
    },
    {
      "type": "UPDATE",
      "skill_id": "skill-id-to-update",
      "new_content": "Refined content with context tag like [Batch] or [API]",
      "reasoning": "How this clarifies the distinction"
    }
  ]
}
\`\`\`

**Guidelines:**
- Consider helpful/harmful counts (higher = more validated, prefer keeping these)
- MERGE when skills are semantically identical or near-identical
- KEEP when they serve different contexts (batch vs real-time, different APIs, etc.)
- UPDATE to add context tags like "[Batch Jobs]" or "[User-Facing API]" to differentiate
- DELETE only when one is clearly redundant with no unique value

`);

  return parts.join("");
}

export function formatPairForLogging(
  skillA: Skill,
  skillB: Skill,
  similarity: number
): string {
  /**
   * Format a single pair for logging output.
   */
  const truncateA = skillA.content.substring(0, 50);
  const truncateB = skillB.content.substring(0, 50);
  const formattedSimilarity = `${Math.round(similarity * 100)}%`;

  return (
    `[${skillA.id}] '${truncateA}...' ` +
    `↔ [${skillB.id}] '${truncateB}...' ` +
    `(${formattedSimilarity} similar)`
  );
}
