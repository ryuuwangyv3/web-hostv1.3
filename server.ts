import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import axios from "axios";
import AdmZip from "adm-zip";
import * as git from "isomorphic-git";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to clean up "primary:" or "primary%3A" from paths and handle both slash types
const cleanPathString = (p: string) => {
  if (!p) return "";
  // Replace %3A with : and %2F with /
  let cleaned = p.replace(/%3A/gi, ":").replace(/%2F/gi, "/");
  // Replace backslashes with forward slashes
  cleaned = cleaned.replace(/\\/g, "/");
  
  // Look for any volume/provider prefix (e.g., "primary:", "tree/document/primary:")
  // We want the part after the last colon
  const lastColonIndex = cleaned.lastIndexOf(":");
  if (lastColonIndex !== -1) {
    cleaned = cleaned.substring(lastColonIndex + 1);
  }
  
  // Also remove common prefixes like "tree/" if they still exist
  cleaned = cleaned.replace(/^tree\//i, "");
  
  // Remove leading slashes
  return cleaned.replace(/^\/+/, "");
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let targetDir = __dirname;
    if (req.body.path) {
      // Clean the path from primary: prefixes
      let safePath = cleanPathString(req.body.path);
      
      // Ensure it starts with 'projects/'
      if (!safePath.startsWith("projects/")) {
        safePath = path.join("projects", safePath);
      }
      targetDir = path.join(__dirname, safePath);
    }
    
    try {
      // Security check: ensure we are within projects directory
      const resolvedTarget = path.resolve(targetDir);
      const resolvedProjects = path.resolve(__dirname, "projects");
      
      if (!resolvedTarget.startsWith(resolvedProjects) && resolvedTarget !== path.resolve(__dirname)) {
        return cb(new Error("Access denied: Invalid upload path"), targetDir);
      }
      
      fsSync.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    } catch (err) {
      cb(err as Error, targetDir);
    }
  },
  filename: (req, file, cb) => {
    // Ensure we only get the basename, handling both slash types
    const originalName = file.originalname.replace(/\\/g, "/");
    const baseName = originalName.split("/").pop() || originalName;
    cb(null, cleanPathString(baseName));
  },
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Security: Files to ignore at root or anywhere
  const IGNORED_PATTERNS = [".git", ".next", "dist", ".DS_Store"];

  const isIgnored = (filePath: string) => {
    const fileName = path.basename(filePath);
    return IGNORED_PATTERNS.some(pattern => 
      fileName === pattern || 
      filePath.split(path.sep).includes(pattern)
    );
  };

  const PROJECTS_DIR = path.join(__dirname, "projects");
  await fs.mkdir(PROJECTS_DIR, { recursive: true });

  const isSafePath = (filePath: string) => {
    const resolvedPath = path.resolve(__dirname, filePath);
    const isUnderRoot = resolvedPath.startsWith(__dirname);
    const isUnderProjects = resolvedPath.startsWith(PROJECTS_DIR);
    
    return (isUnderRoot || isUnderProjects) && !isIgnored(filePath);
  };

  // API: List Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
      const projects = entries
        .filter(e => e.isDirectory())
        .map(e => ({ name: e.name, path: `projects/${e.name}` }));
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to list projects" });
    }
  });

  // API: Create Project
  app.post("/api/projects", async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Project name is required" });
    
    const projectPath = path.join(PROJECTS_DIR, name);
    try {
      await fs.mkdir(projectPath, { recursive: true });
      // Create a basic README or index.html
      await fs.writeFile(path.join(projectPath, "README.md"), `# ${name}\n\nNew project created with Akasha.`);
      res.json({ success: true, path: `projects/${name}` });
    } catch (error) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // API: List files
  app.get("/api/files", async (req, res) => {
    const rootDir = req.query.root ? path.resolve(__dirname, req.query.root as string) : __dirname;
    
    if (!rootDir.startsWith(__dirname) && !rootDir.startsWith(PROJECTS_DIR)) {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const getFiles = async (dir: string): Promise<any[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(
          entries.map(async (entry) => {
            const resPath = path.resolve(dir, entry.name);
            const relativePath = path.relative(__dirname, resPath);
            
            // Hide sensitive files and the projects directory from root list
            if (isIgnored(relativePath)) return null;
            if (dir === __dirname && entry.name === "projects") return null;

            if (entry.isDirectory()) {
              const children = await getFiles(resPath);
              return {
                name: entry.name,
                path: relativePath,
                type: "directory",
                children: children,
              };
            } else {
              return {
                name: entry.name,
                path: relativePath,
                type: "file",
              };
            }
          })
        );
        return files.filter(Boolean);
      };

      const fileTree = await getFiles(rootDir);
      res.json(fileTree);
    } catch (error) {
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // API: Read file
  app.get("/api/file", async (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath || !isSafePath(filePath)) {
      return res.status(403).json({ error: "Access denied or invalid path" });
    }

    try {
      const fullPath = path.resolve(__dirname, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      res.json({ content });
    } catch (error) {
      res.status(500).json({ error: "Failed to read file" });
    }
  });

  // API: Write file
  app.post("/api/file", async (req, res) => {
    const { path: filePath, content } = req.body;
    if (!filePath || !isSafePath(filePath)) {
      return res.status(403).json({ error: "Access denied or invalid path" });
    }

    try {
      const fullPath = path.resolve(__dirname, filePath);
      await fs.writeFile(fullPath, content, "utf-8");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to write file" });
    }
  });

  // API: Create directory
  app.post("/api/mkdir", async (req, res) => {
    const { path: dirPath } = req.body;
    if (!dirPath || !isSafePath(dirPath)) {
      return res.status(403).json({ error: "Access denied or invalid path" });
    }

    try {
      const fullPath = path.resolve(__dirname, dirPath);
      await fs.mkdir(fullPath, { recursive: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to create directory" });
    }
  });

  // API: Upload files
  app.post("/api/upload", upload.array("files"), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const results = [];

    for (const file of files) {
      if (file.originalname.toLowerCase().endsWith(".zip")) {
        try {
          const zip = new AdmZip(file.path);
          const zipEntries = zip.getEntries();
          const targetDir = path.dirname(file.path);

          for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            
            // Clean the entry name to prevent path traversal and handle weird prefixes
            // Normalize backslashes to forward slashes for cross-platform ZIPs
            const entryName = entry.entryName.replace(/\\/g, "/");
            const fullPath = path.join(targetDir, entryName);
            
            // Security check: ensure extracted file is within targetDir
            const resolvedPath = path.resolve(fullPath);
            const resolvedTarget = path.resolve(targetDir);
            
            if (!resolvedPath.startsWith(resolvedTarget)) {
              console.warn(`Skipping potentially malicious entry: ${entryName}`);
              continue;
            }

            // Create directories recursively for the entry
            const entryDir = path.dirname(fullPath);
            if (!fsSync.existsSync(entryDir)) {
              await fs.mkdir(entryDir, { recursive: true });
            }
            
            await fs.writeFile(fullPath, entry.getData());
          }
          
          // Delete the zip file after successful extraction
          await fs.unlink(file.path);
          results.push({ name: file.originalname, extracted: true });
        } catch (error) {
          console.error(`Failed to extract ${file.originalname}:`, error);
          results.push({ name: file.originalname, extracted: false, error: "Extraction failed" });
        }
      } else {
        results.push({ name: file.originalname, extracted: false });
      }
    }

    res.json({ success: true, files: results });
  });

  // API: Delete file or directory
  app.delete("/api/file", async (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath || !isSafePath(filePath)) {
      return res.status(403).json({ error: "Access denied or invalid path" });
    }

    try {
      const fullPath = path.resolve(__dirname, filePath);
      await fs.rm(fullPath, { recursive: true, force: true });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete" });
    }
  });

  // API: Rename file or directory
  app.post("/api/rename", async (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath || !isSafePath(oldPath) || !isSafePath(newPath)) {
      return res.status(403).json({ error: "Access denied or invalid path" });
    }

    try {
      const fullOldPath = path.resolve(__dirname, oldPath);
      const fullNewPath = path.resolve(__dirname, newPath);
      await fs.rename(fullOldPath, fullNewPath);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to rename" });
    }
  });

  // API: Cleanup all paths in projects directory
  app.post("/api/cleanup-paths", async (req, res) => {
    try {
      const cleanup = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const oldName = entry.name;
          const fullOldPath = path.join(dir, oldName);
          
          // Check if name needs cleaning
          if (oldName.includes("primary:") || oldName.includes("primary%3A")) {
            const newName = cleanPathString(oldName);
            const fullNewPath = path.join(dir, newName);
            
            if (fullOldPath !== fullNewPath) {
              try {
                await fs.rename(fullOldPath, fullNewPath);
                console.log(`Cleaned: ${oldName} -> ${newName}`);
              } catch (e) {
                console.error(`Failed to rename ${oldName}:`, e);
              }
            }
            
            // If it was a directory, continue cleanup in the new path
            if (entry.isDirectory()) {
              await cleanup(path.join(dir, newName));
            }
          } else if (entry.isDirectory()) {
            await cleanup(fullOldPath);
          }
        }
      };

      await cleanup(PROJECTS_DIR);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Cleanup failed" });
    }
  });

  // API: Import from GitHub
  app.post("/api/import-github", async (req, res) => {
    const { url, projectName } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const targetDir = projectName ? path.join(PROJECTS_DIR, projectName) : __dirname;

    try {
      // Convert github.com/user/repo to api.github.com/repos/user/repo/zipball/main
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return res.status(400).json({ error: "Invalid GitHub URL" });

      const [_, user, repo] = match;
      const zipUrl = `https://api.github.com/repos/${user}/${repo.replace(".git", "")}/zipball/main`;

      const response = await axios.get(zipUrl, { responseType: "arraybuffer" });
      const zip = new AdmZip(Buffer.from(response.data));
      const zipEntries = zip.getEntries();

      // GitHub ZIPs have a root folder
      const rootFolderName = zipEntries[0].entryName.split("/")[0];

      await fs.mkdir(targetDir, { recursive: true });

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;
        
        const relativePath = entry.entryName.replace(`${rootFolderName}/`, "");
        if (!relativePath) continue;

        const fullPath = path.join(targetDir, relativePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, entry.getData());
      }

      res.json({ success: true, path: projectName ? `projects/${projectName}` : "" });
    } catch (error) {
      console.error("GitHub import failed:", error);
      res.status(500).json({ error: "Failed to import from GitHub" });
    }
  });

  // API: Extract source code from URL
  app.post("/api/extract-url", async (req, res) => {
    let { url, projectPath } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Add protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000 // 10s timeout
      });
      
      const html = response.data;
      let domain = "unknown";
      try {
        domain = new URL(url).hostname.replace(/\./g, '_');
      } catch (e) {
        domain = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      }
      
      const fileName = `extracted_${domain}.html`;
      const targetDir = projectPath ? path.resolve(__dirname, projectPath) : __dirname;
      const filePath = path.join(targetDir, fileName);
      
      await fs.writeFile(filePath, html, "utf-8");
      
      res.json({ success: true, fileName: projectPath ? `${projectPath}/${fileName}` : fileName });
    } catch (error: any) {
      console.error("URL extraction failed:", error.message);
      const errorMsg = error.response ? `Server responded with ${error.response.status}` : error.message;
      res.status(500).json({ error: `Failed to extract from URL: ${errorMsg}` });
    }
  });

  // Git API Endpoints
  const getGitDir = (projectPath: string) => {
    const dir = projectPath ? path.resolve(__dirname, projectPath) : __dirname;
    return dir;
  };

  app.post("/api/git/init", async (req, res) => {
    const { projectPath } = req.body;
    const dir = getGitDir(projectPath);
    try {
      await git.init({ fs: fsSync, dir });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/git/status", async (req, res) => {
    const { projectPath } = req.query;
    const dir = getGitDir(projectPath as string);
    try {
      const status = await git.statusMatrix({ fs: fsSync, dir });
      // statusMatrix returns [filepath, head, workdir, stage]
      // 0: filepath
      // 1: head (0: absent, 1: present)
      // 2: workdir (0: absent, 1: deleted, 2: modified/added)
      // 3: stage (0: absent, 1: present, 2: modified/added)
      const results = status.map(([filepath, head, workdir, stage]) => ({
        filepath,
        head,
        workdir,
        stage,
      }));
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/git/commit", async (req, res) => {
    const { projectPath, message, author } = req.body;
    const dir = getGitDir(projectPath);
    try {
      // Add all files to stage first (simplified for this UI)
      const status = await git.statusMatrix({ fs: fsSync, dir });
      for (const [filepath, head, workdir, stage] of status) {
        if (workdir !== stage) {
          if (workdir === 0) {
            await git.remove({ fs: fsSync, dir, filepath });
          } else {
            await git.add({ fs: fsSync, dir, filepath });
          }
        }
      }

      const sha = await git.commit({
        fs: fsSync,
        dir,
        message,
        author: {
          name: author?.name || "Akasha User",
          email: author?.email || "user@akasha.dev",
        },
      });
      res.json({ success: true, sha });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/git/log", async (req, res) => {
    const { projectPath } = req.query;
    const dir = getGitDir(projectPath as string);
    try {
      const log = await git.log({ fs: fsSync, dir, depth: 50 });
      res.json(log);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/git/branches", async (req, res) => {
    const { projectPath } = req.query;
    const dir = getGitDir(projectPath as string);
    try {
      const branches = await git.listBranches({ fs: fsSync, dir });
      const currentBranch = await git.currentBranch({ fs: fsSync, dir });
      res.json({ branches, currentBranch });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/git/branch", async (req, res) => {
    const { projectPath, name } = req.body;
    const dir = getGitDir(projectPath);
    try {
      await git.branch({ fs: fsSync, dir, ref: name });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/git/checkout", async (req, res) => {
    const { projectPath, name } = req.body;
    const dir = getGitDir(projectPath);
    try {
      await git.checkout({ fs: fsSync, dir, ref: name });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/git/merge", async (req, res) => {
    const { projectPath, theirRef } = req.body;
    const dir = getGitDir(projectPath);
    try {
      const result = await git.merge({
        fs: fsSync,
        dir,
        theirs: theirRef,
        author: {
          name: "Akasha User",
          email: "user@akasha.dev",
        },
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper: Validate code before execution
  const validateCode = async (): Promise<{ success: boolean; output: string }> => {
    const { exec } = await import("child_process");
    const util = await import("util");
    const execPromise = util.promisify(exec);
    
    let validationOutput = "";
    let allSuccess = true;

    try {
      // Check TypeScript/React files
      try {
        const { stdout } = await execPromise("npx tsc --noEmit", { cwd: __dirname });
        if (stdout) validationOutput += stdout;
      } catch (err: any) {
        if (err.stdout) {
          validationOutput += "\n[TypeScript/React Syntax Errors]\n" + err.stdout;
        } else {
          validationOutput += "\n[TypeScript Check Failed] " + err.message;
        }
        allSuccess = false;
      }

      // Check Python files if any exist
      const files = await fs.readdir(__dirname);
      const pyFiles = files.filter(f => f.endsWith(".py"));
      if (pyFiles.length > 0) {
        for (const file of pyFiles) {
          try {
            await execPromise(`python3 -m py_compile "${file}"`, { cwd: __dirname });
          } catch (err: any) {
            validationOutput += `\n[Python Error in ${file}]\n` + (err.stderr || err.message);
            allSuccess = false;
          }
        }
      }

      // Check PHP files if any exist
      const phpFiles = files.filter(f => f.endsWith(".php"));
      if (phpFiles.length > 0) {
        for (const file of phpFiles) {
          try {
            const { stdout } = await execPromise(`php -l "${file}"`, { cwd: __dirname });
          } catch (err: any) {
            validationOutput += `\n[PHP Error in ${file}]\n` + (err.stderr || err.message);
            allSuccess = false;
          }
        }
      }

      return { success: allSuccess, output: validationOutput.trim() };
    } catch (error: any) {
      return { success: false, output: `Validation system error: ${error.message}` };
    }
  };

  // API: Execute shell command
  app.post("/api/shell", async (req, res) => {
    const { command, projectPath } = req.body;
    if (!command) return res.status(400).json({ error: "Command is required" });

    const { exec } = await import("child_process");
    
    const cwd = projectPath ? path.resolve(__dirname, projectPath) : __dirname;
    
    // Commands that trigger validation
    const executionCmds = ["node", "python", "php", "npm run", "npm start", "vite", "tsx", "check"];
    const shouldValidate = executionCmds.some(cmd => command.startsWith(cmd));

    let validationResult = null;
    if (shouldValidate) {
      validationResult = await validateCode();
      
      // If the command was just 'check', return the validation result immediately
      if (command === "check") {
        return res.json({
          success: validationResult.success,
          stdout: validationResult.success ? "✅ All checks passed!" : "",
          stderr: validationResult.output,
          validationOutput: validationResult.output
        });
      }

      if (!validationResult.success) {
        return res.json({
          success: false,
          error: "Code validation failed before execution.",
          stdout: "",
          stderr: validationResult.output,
          validationFailed: true
        });
      }
    }

    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        return res.json({ 
          success: false, 
          error: error.message,
          stdout: stdout,
          stderr: stderr,
          validationOutput: validationResult?.output || ""
        });
      }
      res.json({ 
        success: true, 
        stdout: stdout, 
        stderr: stderr,
        validationOutput: validationResult?.output || ""
      });
    });
  });

  // Serve static files from projects directory
  app.use("/projects", express.static(PROJECTS_DIR));

  // Serve static HTML files (e.g. extracted files) before Vite middleware
  app.use((req, res, next) => {
    if (req.path.endsWith(".html") && req.path !== "/index.html") {
      const fullPath = path.join(__dirname, req.path);
      if (isSafePath(req.path.substring(1))) {
        if (fsSync.existsSync(fullPath)) {
          return res.sendFile(fullPath);
        }
      }
    }
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
