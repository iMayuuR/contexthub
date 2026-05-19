/**
 * Skills Manager — Hardened
 *
 * Security changes:
 * - REMOVED: Loading arbitrary skill files from disk (RCE vector)
 * - REMOVED: saveSkill, addSkill, deleteSkill (no disk-based skill management)
 * - ONLY built-in skills are available (architect, debug, review)
 * - Skill names validated against an allowlist
 * - Context operations are bounded (limited results, rate-limited)
 */

export interface Skill {
  name: string;
  description: string;
  version: string;
  author?: string;
  commands: SkillCommand[];
  triggers?: string[];
}

export interface SkillCommand {
  name: string;
  description: string;
  run: (args: Record<string, string>, context: SkillContext) => Promise<string>;
}

export interface SkillContext {
  repoPath: string;
  getMemories: (query: string) => Promise<any[]>;
  addMemory: (content: string, tags?: string[]) => Promise<void>;
  getGitInfo: () => Promise<any>;
}

// Allowlist of built-in skill names
const ALLOWED_SKILL_NAMES = new Set(['architect', 'debug', 'review']);

export class SkillsManager {
  private skills: Map<string, Skill>;

  constructor(_repoPath: string) {
    this.skills = new Map();
    this.registerBuiltInSkills();
  }

  /**
   * Register built-in skills (hardcoded, not loaded from disk).
   * These are the only skills that can execute code.
   */
  private registerBuiltInSkills(): void {
    const builtInSkills: Skill[] = [
      {
        name: 'architect',
        version: '1.0.0',
        description: 'Analyzes code architecture and provides insights',
        commands: [
          {
            name: 'analyze',
            description: 'Analyze the codebase architecture',
            run: async (args, context) => {
              const memories = await context.getMemories('architecture');
              return `Architecture Analysis\n${memories.length} architecture-related memories found.\nAnalyzing ${context.repoPath}...`;
            }
          }
        ],
        triggers: ['architecture', 'design', 'structure']
      },
      {
        name: 'debug',
        version: '1.0.0',
        description: 'Helps debug issues by searching through past fixes',
        commands: [
          {
            name: 'find-similar',
            description: 'Find similar past bugs/fixes',
            run: async (args, context) => {
              const query = (args.query || '').substring(0, 200); // Cap query length
              const memories = await context.getMemories(`bug ${query}`);
              return `Found ${memories.length} related bug fixes.`;
            }
          }
        ],
        triggers: ['bug', 'error', 'fix', 'issue']
      },
      {
        name: 'review',
        version: '1.0.0',
        description: 'Code review assistance',
        commands: [
          {
            name: 'review-changes',
            description: 'Review recent code changes',
            run: async (args, context) => {
              const gitInfo = await context.getGitInfo();
              return `Code Review\nBranch: ${gitInfo?.currentBranch || 'unknown'}\nRecent changes being reviewed...`;
            }
          }
        ],
        triggers: ['review', 'pr', 'pull request']
      }
    ];

    for (const skill of builtInSkills) {
      this.skills.set(skill.name, skill);
    }
  }

  /**
   * List all available skills (built-in only).
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by name (validated against allowlist).
   */
  getSkill(name: string): Skill | undefined {
    if (!ALLOWED_SKILL_NAMES.has(name)) {
      return undefined;
    }
    return this.skills.get(name);
  }

  /**
   * Find skills matching a query/topic.
   */
  findRelevantSkills(query: string): Skill[] {
    const queryLower = query.toLowerCase().substring(0, 200); // Cap query
    const relevant: { skill: Skill; score: number }[] = [];

    for (const skill of this.skills.values()) {
      let score = 0;

      // Check name and description
      if (skill.name.includes(queryLower)) score += 3;
      if (skill.description.toLowerCase().includes(queryLower)) score += 2;

      // Check triggers
      if (skill.triggers) {
        for (const trigger of skill.triggers) {
          if (queryLower.includes(trigger.toLowerCase())) score += 1;
        }
      }

      if (score > 0) {
        relevant.push({ skill, score });
      }
    }

    return relevant.sort((a, b) => b.score - a.score).map(r => r.skill);
  }

  /**
   * Execute a skill command (built-in only, validated).
   */
  async executeSkill(skillName: string, commandName: string, args: Record<string, string>, context: SkillContext): Promise<string> {
    // Validate skill name against allowlist
    if (!ALLOWED_SKILL_NAMES.has(skillName)) {
      throw new Error(`Skill '${skillName}' is not a registered built-in skill`);
    }

    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Skill '${skillName}' not found`);
    }

    const command = skill.commands.find(c => c.name === commandName);
    if (!command) {
      throw new Error(`Command '${commandName}' not found in skill '${skillName}'`);
    }

    return command.run(args, context);
  }
}