import { window } from "vscode";
import { getLimit, openDiff } from "../historyView/common";
import { ResourceKind } from "../pathNormalizer";
import { Repository } from "../repository";
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

    const path_normalizer = repository.getPathNormalizer();
    const info = await repository.info(current_text_edit.document.uri.fsPath);
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
