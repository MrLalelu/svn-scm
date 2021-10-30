import { window } from "vscode";
import { getLimit, openDiff } from "../historyView/common";
import { ResourceKind } from "../pathNormalizer";
import { Repository } from "../repository";
import SvnError from "../svnError";
import { Command } from "./command";

export class DiffWithRevision extends Command {
  constructor() {
    super("svn.diffWithRevision", { repository: true });
  }

  public async execute(repository: Repository) {
    const log_limit = getLimit();
    const current_text_edit = window.activeTextEditor;
    if (current_text_edit === undefined) {
      window.showErrorMessage("Cannot show diff if no file is selected!");
      return;
    }

    // check that this is an svn file
    const file_uri = current_text_edit.document.uri.fsPath;
    if (!file_uri.startsWith(repository.workspaceRoot)) {
      window.showErrorMessage(
        "Can only create SVN diff for files from this svn repo"
      );
      return;
    }
    // make path relative - use substring instead of + "/" to handle windows and linux
    // delimiter.
    const file_uri_relative = file_uri
      .replace(repository.workspaceRoot, "")
      .substring(1);

    let current_revision: string;
    try {
      current_revision = await repository.getCurrentRevision(file_uri_relative);
    } catch (error) {
      // handle error here, to make sure we can talk to svn regaring the
      // selected file and that it is actually versioned.
      console.log(error);

      if (
        error instanceof SvnError &&
        error.stderrFormated !== undefined &&
        (error.stderrFormated.includes("is not a working copy") ||
          error.stderrFormated.includes("because some targets don't exist"))
      ) {
        await window.showErrorMessage(
          "Can only create SVN diff for files that are versioned in SVN."
        );
      } else {
        await window.showErrorMessage(
          "Could not collect information needed for diff"
        );
      }
      return;
    }

    const path_normalizer = repository.getPathNormalizer();
    const selected_file_svnir = path_normalizer.parse(
      current_text_edit.document.uri.fsPath,
      ResourceKind.LocalFull,
      current_revision
    );

    const log = await repository.log(
      "1",
      "HEAD",
      log_limit,
      selected_file_svnir.remoteFullPath
    );

    // map from revision text to revision number (as string)
    const revisions: Map<string, string> = new Map();
    log.reverse().forEach(element => {
      let tmp_revision = "r" + element.revision;
      if (element.revision == current_revision) {
        tmp_revision += " (current)";
      }
      revisions.set(tmp_revision, element.revision);
    });

    const selected_revision = await window.showQuickPick(
      Array.from(revisions.keys()),
      {
        placeHolder:
          "select revision to diff current file with (current: " +
          current_revision +
          ")"
      }
    );

    if (selected_revision === undefined) {
      return;
    }
    const selected_revision_number = revisions.get(selected_revision);
    if (selected_revision_number === undefined) {
      // This should never happen!
      await window.showErrorMessage("Unexpected error");
      return;
    }

    await openDiff(
      repository,
      selected_file_svnir.remoteFullPath,
      selected_revision_number,
      current_revision
    );
  }
}
