import * as fs from 'fs';
import * as path from 'path';

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

export class SkillsManager {
  private skillsPath: string;
  private skills: Map<string, Skill>;

  constructor(repoPath: string) {
    this.skillsPath = path.join(repoPath, '.contexthub', 'skills');
    this.skills = new Map();
    this.loadSkills();
  }

  /**
   * Load all skills from the skills directory
   */
  private loadSkills(): void {
    try {
      if (!fs.existsSync(this.skillsPath)) {
        fs.mkdirSync(this.skillsPath, { recursive: true });
        this.createDefaultSkills();
        return;
      }

      const files = fs.readdirSync(this.skillsPath).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const skillData = JSON.parse(fs.readFileSync(path.join(this.skillsPath, file), 'utf-8'));
          this.skills.set(skillData.name, skillData);
        } catch (e) {
          console.error(`Failed to load skill ${file}:`, e);
        }
      }

      if (this.skills.size === 0) {
        this.createDefaultSkills();
      }
    } catch (e) {
      console.error('Failed to load skills:', e);
      this.createDefaultSkills();
    }
  }

  /**
   * Create default skills
   */
  private createDefaultSkills(): void {
    const defaultSkills: Skill[] = [
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
              const memories = await context.getMemories(`bug ${args.query || ''}`);
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

    // Save default skills
    for (const skill of defaultSkills) {
      this.saveSkill(skill);
    }
  }

  /**
   * Save a skill to disk
   */
  private saveSkill(skill: Skill): void {
    const filePath = path.join(this.skillsPath, `${skill.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(skill, null, 2));
    this.skills.set(skill.name, skill);
  }

  /**
   * List all available skills
   */
  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * Get skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Add a new skill
   */
  addSkill(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill ${skill.name} already exists`);
    }
    this.saveSkill(skill);
  }

  /**
   * Update an existing skill
   */
  updateSkill(name: string, updates: Partial<Skill>): void {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill ${name} not found`);
    }
    const updated = { ...skill, ...updates, name };
    this.saveSkill(updated);
  }

  /**
   * Delete a skill
   */
  deleteSkill(name: string): void {
    const filePath = path.join(this.skillsPath, `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.skills.delete(name);
  }

  /**
   * Find skills matching a query/topic
   */
  findRelevantSkills(query: string): Skill[] {
    const queryLower = query.toLowerCase();
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
   * Execute a skill command
   */
  async executeSkill(skillName: string, commandName: string, args: Record<string, string>, context: SkillContext): Promise<string> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Skill ${skillName} not found`);
    }

    const command = skill.commands.find(c => c.name === commandName);
    if (!command) {
      throw new Error(`Command ${commandName} not found in skill ${skillName}`);
    }

    return command.run(args, context);
  }

  /**
   * Register a dynamic skill from code
   */
  registerDynamicSkill(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }
}