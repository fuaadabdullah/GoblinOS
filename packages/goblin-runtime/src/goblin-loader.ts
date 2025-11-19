/**
 * Goblin Loader Service
 *
 * Central service for discovering, loading, and registering goblin packages.
 *
 * Responsibilities:
 * - Scan packages/goblins/ directory for valid goblin packages
 * - Load and validate goblin configurations
 * - Run database migrations for each goblin
 * - Register goblin logic with the main application
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';

// Temporary interface until @goblinos/shared is available
interface GoblinInterface {
  initialize(): Promise<void>;
  execute(context: any): Promise<any>;
  shutdown(): Promise<void>;
  getCapabilities(): any;
}

// Temporary interface until @goblinos/shared is available
interface GoblinInterface {
  initialize(): Promise<void>;
  execute(context: any): Promise<any>;
  shutdown(): Promise<void>;
  getCapabilities(): any;
}

interface GoblinConfig {
  [key: string]: any;
}

interface GoblinPackage {
  id: string;
  path: string;
  config: GoblinConfig;
  goblin: GoblinInterface;
}

interface GoblinLoaderOptions {
  goblinDir?: string;
  configOverrides?: Record<string, any>;
}

export class GoblinLoader {
  private goblins: Map<string, GoblinPackage> = new Map();
  private options: GoblinLoaderOptions;

  constructor(options: GoblinLoaderOptions = {}) {
    this.options = {
      goblinDir: options.goblinDir || this.getDefaultGoblinDir(),
      ...options,
    };
  }

  /**
   * Get the default goblins directory path
   */
  private getDefaultGoblinDir(): string {
    // In ES modules, use import.meta.url to get the current file path
    const currentFile = new URL(import.meta.url).pathname;
    const runtimeDir = dirname(currentFile);
    const packagesDir = dirname(dirname(runtimeDir)); // Go up one more level to reach packages/
    return join(packagesDir, 'goblins');
  }

  /**
   * Discover and load all valid goblin packages
   */
  async loadAllGoblins(): Promise<void> {
    console.log('🔍 Discovering goblin packages...');

    const goblinDirs = await this.scanGoblinDirectories();
    console.log(`📁 Found ${goblinDirs.length} potential goblin directories`);

    const loadPromises = goblinDirs.map(dirName =>
      this.loadGoblinPackage(dirName).then(goblinPackage => {
        if (goblinPackage) { // Check if a valid package was loaded
          this.goblins.set(goblinPackage.id, goblinPackage);
          console.log(`✅ Loaded goblin: ${goblinPackage.id}`);
        }
      }).catch(error => {
        console.warn(`⚠️  Failed to load goblin ${dirName}:`, error);
      })
    );

    await Promise.all(loadPromises);

    console.log(`🎯 Successfully loaded ${this.goblins.size} goblins`);
  }

  /**
   * Scan the goblins directory for potential goblin packages
   */
  private async scanGoblinDirectories(): Promise<string[]> {
    const goblinDir = this.options.goblinDir!;

    try {
      await fs.access(goblinDir);
    } catch {
      console.warn(`Goblin directory not found: ${goblinDir}`);
      return [];
    }

    const dirents = await fs.readdir(goblinDir, { withFileTypes: true });
    return dirents
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.') && name !== 'shared' && name !== 'shared-python');
  }

  /**
   * Load a single goblin package
   */
  private async loadGoblinPackage(dirName: string): Promise<GoblinPackage | null> {
    const goblinPath = join(this.options.goblinDir!, dirName);

    // Check if this is a valid goblin package
    const isValid = await this.isValidGoblinPackage(goblinPath);
    if (!isValid) {
      return null;
    }

    // Load configuration
    const config = await this.loadGoblinConfig(goblinPath, dirName);

    // Run migrations if available
    await this.runGoblinMigrations(goblinPath);

    // Load and instantiate the goblin
    const goblin = await this.loadGoblinLogic(goblinPath, config);

    return {
      id: dirName,
      path: goblinPath,
      config,
      goblin,
    };
  }

  /**
   * Check if a directory contains a valid goblin package
   */
  private async isValidGoblinPackage(goblinPath: string): Promise<boolean> {
    const requiredFiles = [
      'package.json',
      'src/index.ts',
      'config/default.json',
      'config/schema.json',
    ];

    const checks = requiredFiles.map(file =>
      fs.access(join(goblinPath, file)).then(() => true).catch(() => false)
    );
    const results = await Promise.all(checks);
    return results.every(result => result);
  }

  /**
   * Load and validate goblin configuration
   */
  private async loadGoblinConfig(goblinPath: string, goblinId: string): Promise<GoblinConfig> {
    const configPath = join(goblinPath, 'config/default.json');

    // Load default config
    const configFile = await fs.readFile(configPath, 'utf-8');
    const defaultConfig = JSON.parse(configFile);
    // Apply any overrides
    const config = {
      ...defaultConfig,
      ...this.options.configOverrides?.[goblinId],
    };

    // TODO: Validate against schema.json using a JSON schema validator
    // For now, just return the config
    console.log(`⚙️  Loaded config for ${goblinId}`);

    return config;
  }

  /**
   * Run database migrations for a goblin
   */
  private async runGoblinMigrations(goblinPath: string): Promise<void> {
    const schemaPath = join(goblinPath, 'dist/schema.js');
    try {
      await fs.access(schemaPath);
    } catch {
      console.log(`ℹ️  No migrations found for ${goblinPath.split('/').pop()}`);
      return;
    }
    try {
      // Dynamic import of the schema module
      const schemaModule = await import(schemaPath);

      // Look for a migrate function
      if (typeof schemaModule.migrate === 'function') {
        console.log(`🗄️  Running migrations for ${goblinPath.split('/').pop()}`);
        await schemaModule.migrate();
      }
    } catch (error) {
      console.warn(`⚠️  Failed to run migrations for ${goblinPath}:`, error);
    }
  }

  /**
   * Load the goblin's logic from dist/index.js (built version) and instantiate it
   */
  private async loadGoblinLogic(goblinPath: string, config: GoblinConfig): Promise<GoblinInterface> {
    const indexPath = join(goblinPath, 'dist/index.js');

    try {
      // Dynamic import of the goblin module
      const goblinModule = await import(indexPath);

      // Look for the main export (should be a class that implements GoblinInterface)
      let GoblinClass: any;
      if (goblinModule.default) {
        GoblinClass = goblinModule.default;
      } else {
        // Fallback: look for named exports
        const exports = Object.keys(goblinModule);
        if (exports.length === 1) {
          GoblinClass = goblinModule[exports[0]];
        } else {
          throw new Error(`Could not find main export in ${indexPath}`);
        }
      }

      // Instantiate the goblin class with config
      if (typeof GoblinClass === 'function') {
        const goblinInstance = new GoblinClass(config);
        return goblinInstance;
      } else {
        throw new Error(`Main export is not a class constructor in ${indexPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to load goblin logic from ${indexPath}: ${error}`);
    }
  }

  /**
   * Get a loaded goblin by ID
   */
  getGoblin(goblinId: string): GoblinPackage | undefined {
    return this.goblins.get(goblinId);
  }

  /**
   * Get all loaded goblins
   */
  getAllGoblins(): Map<string, GoblinPackage> {
    return new Map(this.goblins);
  }

  /**
   * Initialize all loaded goblins
   */
  async initializeAllGoblins(): Promise<void> {
    console.log('🚀 Initializing goblins...');

    for (const id of Array.from(this.goblins.keys())) {
      const goblinPackage = this.goblins.get(id)!;
      try {
        await goblinPackage.goblin.initialize();
        console.log(`✅ Initialized goblin: ${id}`);
      } catch (error) {
        console.error(`❌ Failed to initialize goblin ${id}:`, error);
      }
    }
  }

  /**
   * Shutdown all loaded goblins
   */
  async shutdownAllGoblins(): Promise<void> {
    console.log('🛑 Shutting down goblins...');

    for (const id of Array.from(this.goblins.keys())) {
      const goblinPackage = this.goblins.get(id)!;
      try {
        await goblinPackage.goblin.shutdown();
        console.log(`✅ Shutdown goblin: ${id}`);
      } catch (error) {
        console.error(`❌ Failed to shutdown goblin ${id}:`, error);
      }
    }
  }

  /**
   * Get goblin capabilities summary
   */
  getCapabilitiesSummary(): Record<string, any> {
    const summary: Record<string, any> = {};

    for (const id of Array.from(this.goblins.keys())) {
      const goblinPackage = this.goblins.get(id)!;
      try {
        summary[id] = goblinPackage.goblin.getCapabilities();
      } catch (error) {
        summary[id] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    return summary;
  }

  /**
   * Get the number of loaded goblins
   */
  getLoadedGoblinCount(): number {
    return this.goblins.size;
  }
}
