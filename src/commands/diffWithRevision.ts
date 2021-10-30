import { window } from "vscode";
import { ISvnInfo } from "../common/types";
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

    const path_normalizer = repository.getPathNormalizer();
    let info: ISvnInfo;
    try {
      // for some reason this command crashes the entire svn plugin if
      // called with a file not from the svn folder. Therefore
      // it is checked above, that the command is called with an svn file
      info = await repository.info(current_text_edit.document.uri.fsPath);
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

    const selected_file_svnir = path_normalizer.parse(
      current_text_edit.document.uri.fsPath,
      ResourceKind.LocalFull,
      info.revision
    );

    const log = await repository.log(
      "1",
      "HEAD",
      log_limit,
      selected_file_svnir.remoteFullPath
    );

    const revisions: string[] = [];
    log.forEach(element => {
      let tmp_revision = "r" + element.revision;
      if (element.revision == info.revision) {
        tmp_revision += " (current)";
      }
      revisions.push(tmp_revision);
    });

    const selected_revision = await window.showQuickPick(revisions.reverse(), {
      placeHolder: "select revision to diff current file with"
    });

    if (selected_revision === undefined) {
      return;
    }

    await openDiff(
      repository,
      selected_file_svnir.remoteFullPath,
      selected_revision,
      info.revision
    );
  }
}
