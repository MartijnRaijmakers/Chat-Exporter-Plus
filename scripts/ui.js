import { MODULE_ID, SETTING_HIDE_DEFAULT_EXPORT } from "./constants.js";
import { exportChatToJson } from "./export.js";

let ADDED_JSON_EXPORT_BUTTON = false;
let UPDATED_DEFAULT_EXPORT_BUTTON = false;

export function AttachUi(app) {
  if (!ADDED_JSON_EXPORT_BUTTON) {
    attachChatExportButton(app.element);
  }

  if (!UPDATED_DEFAULT_EXPORT_BUTTON) {
    updateDefaultExportButtonHidden(app.element);
  }
}

export function attachChatExportButton(html) {
  ADDED_JSON_EXPORT_BUTTON = true;

  const controls = findControlButtonsContainer(html);
  if (!controls) {
    return;
  }

  const customButton = $(
    `<button
      type="button"
      class="ui-control icon fa-solid fa-file-brackets-curly"
      data-chat-exporter-plus="true"
      title="Export full Chat Log as JSON"
      aria-label="Export full Chat Log as JSON"
    />`
  );

  customButton.on("click", (event) => {
    event.preventDefault();
    exportChatToJson();
  });

  $(controls).prepend(customButton);
}

export function updateDefaultExportButtonHidden(html) {
  const exportButton = findExportButton(html);
  const hideDefault = game.settings.get(MODULE_ID, SETTING_HIDE_DEFAULT_EXPORT);
  if (exportButton) {
    if (hideDefault) {
      $(exportButton).hide();
    } else {
      $(exportButton).show();
    }
  }

  UPDATED_DEFAULT_EXPORT_BUTTON = false;
}

export function findControlButtonsContainer(html) {
  return html.querySelector("#chat-controls > div.control-buttons");
}

export function findExportButton(html) {
  return document.querySelector("#chat-controls > div.control-buttons > button[data-action='export']");
}
