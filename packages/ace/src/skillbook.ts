/**
 * Skillbook storage and mutation logic for ACE.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { UpdateBatch, UpdateOperation } from "./updates";

export interface SimilarityDecision {
  /** Record of a SkillManager decision to KEEP two skills separate */
  decision: "KEEP";
  reasoning: string;
  decided_at: string;
  similarity_at_decision: number;
}

export interface Skill {
  /** Single skillbook entry */
  id: string;
  section: string;
  content: string;
  helpful: number;
  harmful: number;
  neutral: number;
  created_at: string;
  updated_at: string;
  /** Deduplication fields */
  embedding?: number[];
  status: "active" | "invalid";
}

export function createSkill(params: {
  id: string;
  section: string;
  content: string;
  helpful?: number;
  harmful?: number;
  neutral?: number;
  embedding?: number[];
  status?: "active" | "invalid";
}): Skill {
  const now = new Date().toISOString();
  return {
    id: params.id,
    section: params.section,
    content: params.content,
    helpful: params.helpful ?? 0,
    harmful: params.harmful ?? 0,
    neutral: params.neutral ?? 0,
    created_at: now,
    updated_at: now,
    embedding: params.embedding,
    status: params.status ?? "active",
  };
}

export function applySkillMetadata(
  skill: Skill,
  metadata: Record<string, number>
): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (key in skill) {
      (skill as any)[key] = value;
    }
  }
}

export function tagSkill(skill: Skill, tag: string, increment = 1): void {
  if (!["helpful", "harmful", "neutral"].includes(tag)) {
    throw new Error(`Unsupported tag: ${tag}`);
  }
  (skill as any)[tag] += increment;
  skill.updated_at = new Date().toISOString();
}

export function skillToLLMDict(skill: Skill): Record<string, any> {
  /**
   * Return dictionary with only LLM-relevant fields.
   *
   * Excludes created_at and updated_at which are internal metadata
   * not useful for LLM strategy selection.
   */
  return {
    id: skill.id,
    section: skill.section,
    content: skill.content,
    helpful: skill.helpful,
    harmful: skill.harmful,
    neutral: skill.neutral,
  };
}

export class Skillbook {
  /** Structured context store as defined by ACE */
  private readonly _skills: Map<string, Skill> = new Map();
  private readonly _sections: Map<string, string[]> = new Map();
  private _nextId = 0;
  /** Store KEEP decisions so we don't re-ask about the same pairs */
  private readonly _similarityDecisions: Map<string, SimilarityDecision> =
    new Map();

  toString(): string {
    /**
     * Human-readable representation showing actual skillbook content.
     *
     * Uses markdown format for readability (not TOON) since this is
     * typically used for debugging/inspection, not LLM prompts.
     */
    if (this._skills.size === 0) {
      return "Skillbook(empty)";
    }
    return this._asMarkdownDebug();
  }

  // ------------------------------------------------------------------ //
  // CRUD utils
  // ------------------------------------------------------------------ //
  addSkill(
    section: string,
    content: string,
    skillId?: string,
    metadata?: Record<string, number>
  ): Skill {
    const id = skillId ?? this._generateId(section);
    const skill = createSkill({ id, section, content });

    if (metadata) {
      applySkillMetadata(skill, metadata);
    }

    this._skills.set(id, skill);

    if (!this._sections.has(section)) {
      this._sections.set(section, []);
    }
    this._sections.get(section)?.push(id);

    return skill;
  }

  updateSkill(
    skillId: string,
    options: {
      content?: string;
      metadata?: Record<string, number>;
    }
  ): Skill | null {
    const skill = this._skills.get(skillId);
    if (!skill) {
      return null;
    }

    if (options.content !== undefined) {
      skill.content = options.content;
    }

    if (options.metadata) {
      applySkillMetadata(skill, options.metadata);
    }

    skill.updated_at = new Date().toISOString();
    return skill;
  }

  tagSkill(skillId: string, tag: string, increment = 1): Skill | null {
    const skill = this._skills.get(skillId);
    if (!skill) {
      return null;
    }

    tagSkill(skill, tag, increment);
    return skill;
  }

  removeSkill(skillId: string, soft = false): void {
    /**
     * Remove a skill from the skillbook.
     *
     * @param skillId - ID of the skill to remove
     * @param soft - If true, mark as invalid instead of deleting (for audit trail)
     */
    const skill = this._skills.get(skillId);
    if (!skill) {
      return;
    }

    if (soft) {
      // Soft delete: mark as invalid but keep in storage
      skill.status = "invalid";
      skill.updated_at = new Date().toISOString();
    } else {
      // Hard delete: remove entirely
      this._skills.delete(skillId);
      const sectionList = this._sections.get(skill.section);
      if (sectionList) {
        const filtered = sectionList.filter((id) => id !== skillId);
        if (filtered.length === 0) {
          this._sections.delete(skill.section);
        } else {
          this._sections.set(skill.section, filtered);
        }
      }
    }
  }

  getSkill(skillId: string): Skill | null {
    return this._skills.get(skillId) ?? null;
  }

  skills(includeInvalid = false): Skill[] {
    /**
     * Get all skills in the skillbook.
     *
     * @param includeInvalid - If true, include soft-deleted skills
     * @returns List of skills (active only by default)
     */
    const allSkills = Array.from(this._skills.values());
    if (includeInvalid) {
      return allSkills;
    }
    return allSkills.filter((s) => s.status === "active");
  }

  // ------------------------------------------------------------------ //
  // Similarity decisions (for deduplication)
  // ------------------------------------------------------------------ //
  private _makePairKey(skillIdA: string, skillIdB: string): string {
    return [skillIdA, skillIdB].sort().join(",");
  }

  getSimilarityDecision(
    skillIdA: string,
    skillIdB: string
  ): SimilarityDecision | null {
    /** Get a prior similarity decision for a pair of skills */
    const pairKey = this._makePairKey(skillIdA, skillIdB);
    return this._similarityDecisions.get(pairKey) ?? null;
  }

  setSimilarityDecision(
    skillIdA: string,
    skillIdB: string,
    decision: SimilarityDecision
  ): void {
    /** Store a similarity decision for a pair of skills */
    const pairKey = this._makePairKey(skillIdA, skillIdB);
    this._similarityDecisions.set(pairKey, decision);
  }

  hasKeepDecision(skillIdA: string, skillIdB: string): boolean {
    /** Check if there's a KEEP decision for this pair */
    const decision = this.getSimilarityDecision(skillIdA, skillIdB);
    return decision !== null && decision.decision === "KEEP";
  }

  // ------------------------------------------------------------------ //
  // Serialization
  // ------------------------------------------------------------------ //
  toDict(): Record<string, any> {
    const skillsObj: Record<string, any> = {};
    for (const [id, skill] of this._skills) {
      skillsObj[id] = { ...skill };
    }

    const sectionsObj: Record<string, string[]> = {};
    for (const [section, ids] of this._sections) {
      sectionsObj[section] = ids;
    }

    const similarityDecisionsObj: Record<string, SimilarityDecision> = {};
    for (const [pairKey, decision] of this._similarityDecisions) {
      similarityDecisionsObj[pairKey] = decision;
    }

    return {
      skills: skillsObj,
      sections: sectionsObj,
      next_id: this._nextId,
      similarity_decisions: similarityDecisionsObj,
    };
  }

  static fromDict(payload: Record<string, any>): Skillbook {
    const instance = new Skillbook();

    const skillsPayload = payload.skills ?? {};
    for (const [skillId, skillValue] of Object.entries(skillsPayload)) {
      if (typeof skillValue === "object" && skillValue !== null) {
        const skillData = skillValue as any;
        // Handle new optional fields with defaults for backwards compatibility
        if (!skillData.embedding) {
          skillData.embedding = undefined;
        }
        if (!skillData.status) {
          skillData.status = "active";
        }
        instance._skills.set(skillId, skillData as Skill);
      }
    }

    const sectionsPayload = payload.sections ?? {};
    for (const [section, ids] of Object.entries(sectionsPayload)) {
      if (Array.isArray(ids)) {
        instance._sections.set(section, ids);
      }
    }

    instance._nextId = payload.next_id ?? 0;

    const similarityDecisionsPayload = payload.similarity_decisions ?? {};
    for (const [pairKey, decision] of Object.entries(
      similarityDecisionsPayload
    )) {
      if (typeof decision === "object" && decision !== null) {
        instance._similarityDecisions.set(
          pairKey,
          decision as SimilarityDecision
        );
      }
    }

    return instance;
  }

  dumps(): string {
    return JSON.stringify(this.toDict(), null, 2);
  }

  static loads(data: string): Skillbook {
    const payload = JSON.parse(data);
    if (typeof payload !== "object" || payload === null) {
      throw new Error("Skillbook serialization must be a JSON object.");
    }
    return Skillbook.fromDict(payload);
  }

  saveToFile(path: string): void {
    /**
     * Save skillbook to a JSON file.
     *
     * @param path - File path where to save the skillbook
     *
     * @example
     * skillbook.saveToFile("trained_model.json")
     */
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path, this.dumps(), "utf-8");
  }

  static loadFromFile(path: string): Skillbook {
    /**
     * Load skillbook from a JSON file.
     *
     * @param path - File path to load the skillbook from
     * @returns Skillbook instance loaded from the file
     *
     * @example
     * const skillbook = Skillbook.loadFromFile("trained_model.json")
     *
     * @throws {Error} If the file doesn't exist or contains invalid JSON
     */
    if (!existsSync(path)) {
      throw new Error(`Skillbook file not found: ${path}`);
    }
    const data = readFileSync(path, "utf-8");
    return Skillbook.loads(data);
  }

  // ------------------------------------------------------------------ //
  // Update application
  // ------------------------------------------------------------------ //
  applyUpdate(update: UpdateBatch): void {
    for (const operation of update.operations) {
      this._applyOperation(operation);
    }
  }

  private _applyOperation(operation: UpdateOperation): void {
    const opType = operation.type.toUpperCase();

    if (opType === "ADD") {
      this.addSkill(
        operation.section,
        operation.content ?? "",
        operation.skill_id,
        operation.metadata
      );
    } else if (opType === "UPDATE") {
      if (!operation.skill_id) {
        return;
      }
      this.updateSkill(operation.skill_id, {
        content: operation.content,
        metadata: operation.metadata,
      });
    } else if (opType === "TAG") {
      if (!operation.skill_id) {
        return;
      }
      // Only apply valid tag names as defensive measure
      const validTags = new Set(["helpful", "harmful", "neutral"]);
      for (const [tag, increment] of Object.entries(operation.metadata ?? {})) {
        if (validTags.has(tag)) {
          this.tagSkill(operation.skill_id, tag, increment);
        }
      }
    } else if (opType === "REMOVE") {
      if (!operation.skill_id) {
        return;
      }
      this.removeSkill(operation.skill_id);
    }
  }

  // ------------------------------------------------------------------ //
  // Presentation helpers
  // ------------------------------------------------------------------ //
  asPrompt(): string {
    /**
     * Return JSON-encoded skillbook for LLM prompts.
     *
     * In TypeScript, we'll use compact JSON instead of TOON.
     * Excludes internal metadata (created_at, updated_at) for token efficiency.
     *
     * @returns JSON-formatted string with skills array
     */
    const skillsData = this.skills().map((s) => skillToLLMDict(s));
    return JSON.stringify({ skills: skillsData });
  }

  private _asMarkdownDebug(): string {
    /**
     * Human-readable markdown format for debugging/inspection only.
     *
     * This format is more readable than JSON but uses more tokens.
     * Use for debugging, logging, or human inspection - not for LLM prompts.
     */
    const parts: string[] = [];
    const sortedSections = Array.from(this._sections.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    for (const [section, skillIds] of sortedSections) {
      parts.push(`## ${section}`);
      for (const skillId of skillIds) {
        const skill = this._skills.get(skillId);
        if (skill) {
          const counters = `(helpful=${skill.helpful}, harmful=${skill.harmful}, neutral=${skill.neutral})`;
          parts.push(`- [${skill.id}] ${skill.content} ${counters}`);
        }
      }
    }
    return parts.join("\n");
  }

  stats(): Record<string, any> {
    const skills = Array.from(this._skills.values());
    return {
      sections: this._sections.size,
      skills: this._skills.size,
      tags: {
        helpful: skills.reduce((sum, s) => sum + s.helpful, 0),
        harmful: skills.reduce((sum, s) => sum + s.harmful, 0),
        neutral: skills.reduce((sum, s) => sum + s.neutral, 0),
      },
    };
  }

  // ------------------------------------------------------------------ //
  // Internal helpers
  // ------------------------------------------------------------------ //
  private _generateId(section: string): string {
    this._nextId += 1;
    const sectionPrefix = section.split(" ")[0].toLowerCase();
    return `${sectionPrefix}-${this._nextId.toString().padStart(5, "0")}`;
  }
}
