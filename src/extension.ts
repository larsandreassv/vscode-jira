import * as vscode from "vscode";
import * as cp from "child_process";

export function activate(context: vscode.ExtensionContext) {
  const gitBranchProvider = new GitBranchTreeDataProvider();
  vscode.window.registerTreeDataProvider("gitBranchesView", gitBranchProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("gitBranchesView.addBranch", () => {
      gitBranchProvider.createBranchFromDevelop();
    }),
    vscode.commands.registerCommand(
      "gitBranchesView.checkoutLocalBranch",
      (branchName: string) => {
        gitBranchProvider.checkoutLocalBranch(branchName);
      }
    ),
    vscode.commands.registerCommand(
      "gitBranchesView.checkoutRemoteBranch",
      (branchName: string) => {
        gitBranchProvider.checkoutRemoteBranch(branchName);
      }
    ),
    vscode.commands.registerCommand(
      "gitBranchesView.deleteLocalBranch",
      (branch: TreeItem) => {
        gitBranchProvider.deleteLocalBranch(branch);
      }
    ),
    vscode.commands.registerCommand(
      "gitBranchesView.pullFromDevelop",
      (branch: TreeItem) => {
        gitBranchProvider.pullFromDevelop(branch);
      }
    ),
    vscode.commands.registerCommand("jiraIssuesView.fetchJiraIssues", () => {
      runPythonScript(["fetch_issues"])
        .then((issues) => {
          vscode.window.showInformationMessage(
            `Fetched Jira Issues: ${JSON.stringify(issues)}`
          );
        })
        .catch((error) => {
          vscode.window.showErrorMessage(
            `Error fetching Jira issues: ${error}`
          );
        });
    }),
    vscode.commands.registerCommand("jiraIssuesView.updateJiraIssue", () => {
      const issueId = "ISSUE-1";
      const newStatus = "Done";

      runPythonScript(["update_issue", issueId, newStatus])
        .then((result) => {
          vscode.window.showInformationMessage(
            `Issue updated: ${JSON.stringify(result)}`
          );
        })
        .catch((error) => {
          vscode.window.showErrorMessage(`Error updating Jira issue: ${error}`);
        });
    })
  );
}

class GitBranchTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | void
  > = new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor() {}

  getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
    if (element) {
      return element.children;
    } else {
      return this.getGitBranches();
    }
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  private getGitBranches(): Promise<TreeItem[]> {
    return Promise.all([this.getLocalBranches(), this.getRemoteBranches()])
      .then(([localBranches, remoteBranches]) => {
        if (!localBranches.length && !remoteBranches.length) {
          vscode.window.showInformationMessage(
            "No Git branches found in the current workspace."
          );
        }

        return [
          new TreeItem("Local Branches", localBranches),
          new TreeItem("Remote Branches", remoteBranches),
        ];
      })
      .catch((error) => {
        vscode.window.showErrorMessage(`Failed to load Git branches: ${error}`);
        return [];
      });
  }

  private getLocalBranches(): Promise<TreeItem[]> {
    return this.getBranches("git branch");
  }

  private getRemoteBranches(): Promise<TreeItem[]> {
    return this.getBranches("git branch -r");
  }

  private getBranches(command: string): Promise<TreeItem[]> {
    return new Promise((resolve, reject) => {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found!");
        reject("No workspace folder found");
        return;
      }

      cp.exec(command, { cwd: workspaceFolder }, (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Error executing ${command}: ${stderr}`
          );
          reject(stderr);
          return;
        }

        const branches = stdout
          .split("\n")
          .filter((branch) => branch.trim() !== "")
          .map(
            (branch) =>
              new TreeItem(
                branch.trim(),
                undefined,
                command === "git branch" ? "local" : "remote"
              )
          );

        resolve(branches);
      });
    });
  }

  createBranchFromDevelop() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec("git branch", { cwd: workspaceFolder }, (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Error checking for develop branch: ${stderr}`
        );
        return;
      }

      const hasDevelopBranch = stdout.includes("develop");

      if (!hasDevelopBranch) {
        vscode.window.showErrorMessage(
          "No 'develop' branch found. Cannot base a new branch on it."
        );
        return;
      }

      vscode.window
        .showInputBox({ prompt: "Enter the new branch name" })
        .then((branchName) => {
          if (!branchName) {
            vscode.window.showErrorMessage("Branch name is required");
            return;
          }

          cp.exec(
            `git checkout develop && git checkout -b ${branchName}`,
            { cwd: workspaceFolder },
            (err, stdout, stderr) => {
              if (err) {
                vscode.window.showErrorMessage(
                  `Failed to create branch: ${stderr}`
                );
                return;
              }

              vscode.window.showInformationMessage(
                `Branch '${branchName}' created based on 'develop'`
              );
              this._onDidChangeTreeData.fire();
            }
          );
        });
    });
  }

  checkoutLocalBranch(branchName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec(
      `git checkout ${branchName}`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to checkout local branch: ${stderr}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Checked out to local branch: ${branchName}`
        );
        this._onDidChangeTreeData.fire();
      }
    );
  }

  checkoutRemoteBranch(branchName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec(
      `git checkout -b ${branchName}`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to checkout remote branch: ${stderr}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Checked out to remote branch: ${branchName}`
        );
        this._onDidChangeTreeData.fire();
      }
    );
  }

  // TODO: Add confirmation dialog.
  deleteLocalBranch(branch: TreeItem) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    vscode.window
      .showInformationMessage(
        `Are you sure you want to delete branch ${branch.label}?`,
        "Yes",
        "No"
      )
      .then((answer) => {
        if (answer === "Yes") {
          cp.exec(
            `git branch -d ${branch.label}`,
            { cwd: workspaceFolder },
            (err, stdout, stderr) => {
              if (err) {
                vscode.window.showErrorMessage(
                  `Failed to delete local branch: ${stderr}`
                );
                return;
              }

              vscode.window.showInformationMessage(
                `Local branch: ${branch.label} deleted`
              );
              this._onDidChangeTreeData.fire();
            }
          );
        }
      });
  }

  pullFromDevelop(branch: TreeItem) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec(
      `git checkout develop && git pull && git checkout ${branch.label}.replace("*", "") && git merge develop`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to merge develop to local branch: ${stderr}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Merged develop to local branch: ${branch.label}`
        );
        this._onDidChangeTreeData.fire();
      }
    );
  }
}

class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;

  constructor(label: string, children?: TreeItem[], type?: "local" | "remote") {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.children = children;

    if (!children) {
      this.command = {
        command:
          type === "local"
            ? "gitBranchesView.checkoutLocalBranch"
            : "gitBranchesView.checkoutRemoteBranch",
        title: `Checkout ${type === "local" ? "Local" : "Remote"} Branch`,
        arguments: [label],
      };
      this.contextValue = `${type}-branch`;
    }
  }
}

class JiraIssueTreeItem extends vscode.TreeItem {
  constructor(public readonly issue: any) {
    super(issue.summary, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${issue.id}: ${issue.summary}`;
    this.description = issue.status;
  }
}

class JiraIssueProvider implements vscode.TreeDataProvider<JiraIssueTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    JiraIssueTreeItem | undefined
  > = new vscode.EventEmitter<JiraIssueTreeItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<JiraIssueTreeItem | undefined> =
    this._onDidChangeTreeData.event;

  private issues: any[] = [];

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: JiraIssueTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): JiraIssueTreeItem[] {
    return this.issues.map((issue) => new JiraIssueTreeItem(issue));
  }

  fetchIssues() {
    runPythonScript(["fetch_issues"]).then((issues) => {
      this.issues = issues;
      this.refresh();
    });
  }
}

function runPythonScript(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      reject("No workspace folder found");
      return;
    }

    const pythonProcess = cp.spawn(
      "python3",
      ["./scripts/script.py", ...args],
      {
        cwd: workspaceFolder,
      }
    );

    let output = "";
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    pythonProcess.on("close", (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (err) {
          reject("Failed to parse JSON from Python script");
        }
      } else {
        reject(`Python script exited with code ${code}`);
      }
    });
  });
}
