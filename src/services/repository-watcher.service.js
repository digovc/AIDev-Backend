const chokidar = require('chokidar');
const ignore = require('ignore');
const path = require('path');
const fs = require('fs');

class RepositoryWatcherService {
  constructor() {
    this.watchedFolders = new Map(); // { folderPath: { watcher, fileTree, timeout, ig } }
  }

  watch(folder) {
    if (this.watchedFolders.has(folder)) return;

    const absolutePath = path.resolve(folder);
    const ig = this.loadGitignore(absolutePath);

    const watcher = chokidar.watch(absolutePath, {
      ignored: (filePath) => {
        const relative = path.relative(absolutePath, filePath);
        return relative && ig.ignores(relative);
      },
      persistent: true,
      ignoreInitial: false
    });

    const fileTree = {
      name: path.basename(absolutePath),
      path: absolutePath,
      type: 'directory',
      children: []
    };

    const folderData = {
      watcher,
      fileTree,
      ig,
      timeout: this.createTimeout(absolutePath)
    };

    this.setupWatcherListeners(watcher, absolutePath, folderData);
    this.watchedFolders.set(absolutePath, folderData);
  }

  searchFiles(folder, filter) {
    const absolutePath = path.resolve(folder);
    let data = this.watchedFolders.get(absolutePath);

    // Reinicia o watch se necessário
    if (!data) {
      this.watch(absolutePath);
      data = this.watchedFolders.get(absolutePath);
    }

    // Renova o timeout
    this.renewTimeout(absolutePath);

    // Realiza a busca
    const results = [];
    const searchTerm = filter.toLowerCase();

    function traverse(node) {
      if (node.type === 'file' && node.name.toLowerCase().includes(searchTerm)) {
        results.push(node.path);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    }

    traverse(data.fileTree);
    return results;
  }

  createTimeout(folder) {
    return setTimeout(() => {
      this.stopWatching(folder);
    }, 5 * 60 * 1000); // 5 minutos
  }

  stopWatching(folder) {
    const data = this.watchedFolders.get(folder);
    if (data) {
      data.watcher.close();
      this.watchedFolders.delete(folder);
    }
  }

  renewTimeout(folder) {
    const data = this.watchedFolders.get(folder);
    if (data) {
      clearTimeout(data.timeout);
      data.timeout = this.createTimeout(folder);
    }
  }

  loadGitignore(folder) {
    const ig = ignore();
    const gitignorePath = path.join(folder, '.gitignore');

    if (fs.existsSync(gitignorePath)) {
      try {
        ig.add(fs.readFileSync(gitignorePath).toString());
      } catch (error) {
        console.error('Error reading .gitignore:', error);
      }
    }
    return ig;
  }

  setupWatcherListeners(watcher, folder, data) {
    watcher
      .on('add', (filePath) => this.handleAdd(filePath, folder, data))
      .on('unlink', (filePath) => this.handleUnlink(filePath, folder, data))
      .on('addDir', (dirPath) => this.handleAddDir(dirPath, folder, data))
      .on('unlinkDir', (dirPath) => this.handleUnlinkDir(dirPath, folder, data))
      .on('rename', (oldPath, newPath) => this.handleRename(oldPath, newPath, folder, data));
  }
  // Métodos de manipulação da árvore (similares ao exemplo anterior, mas com contexto por folder)

  findNode(filePath, folderData) {
    const relativePath = path.relative(folderData.fileTree.path, filePath);
    const parts = relativePath.split(path.sep);
    let currentNode = folderData.fileTree;

    for (const part of parts) {
      const child = currentNode.children.find(c => c.name === part);
      if (!child) return null;
      currentNode = child;
    }
    return currentNode;
  }

  handleAdd(filePath, folder, data) {
    const parentPath = path.dirname(filePath);
    const parentNode = this.findNode(parentPath, data) || data.fileTree;

    parentNode.children.push({
      name: path.basename(filePath),
      path: filePath,
      type: 'file',
      parent: parentNode
    });
  }

  handleUnlink(filePath, folder, data) {
    const parentPath = path.dirname(filePath);
    const parentNode = this.findNode(parentPath, data);

    if (parentNode) {
      const fileIndex = parentNode.children.findIndex(child =>
        child.type === 'file' && child.path === filePath
      );

      if (fileIndex !== -1) {
        parentNode.children.splice(fileIndex, 1);
      }
    }
  }

  handleAddDir(dirPath, folder, data) {
    // Não adicionar o diretório raiz
    if (dirPath === folder) return;

    const parentPath = path.dirname(dirPath);
    const parentNode = this.findNode(parentPath, data) || data.fileTree;

    parentNode.children.push({
      name: path.basename(dirPath),
      path: dirPath,
      type: 'directory',
      children: [],
      parent: parentNode
    });
  }

  handleUnlinkDir(dirPath, folder, data) {
    const parentPath = path.dirname(dirPath);
    const parentNode = this.findNode(parentPath, data);

    if (parentNode) {
      const dirIndex = parentNode.children.findIndex(child =>
        child.type === 'directory' && child.path === dirPath
      );

      if (dirIndex !== -1) {
        parentNode.children.splice(dirIndex, 1);
      }
    }
  }

  handleRename(oldPath, newPath, folder, data) {
    // Para renomeação, removemos o nó antigo e adicionamos um novo
    if (fs.existsSync(newPath)) {
      const isDirectory = fs.statSync(newPath).isDirectory();

      // Remover o antigo
      if (isDirectory) {
        this.handleUnlinkDir(oldPath, folder, data);
        this.handleAddDir(newPath, folder, data);
      } else {
        this.handleUnlink(oldPath, folder, data);
        this.handleAdd(newPath, folder, data);
      }
    }
  }
}

module.exports = new RepositoryWatcherService();
