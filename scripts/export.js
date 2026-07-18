import { DEFAULT_WHITESPACE_MODE } from "./constants.js";
import {
  buildExportMetadata,
  buildExportPayload,
  estimateExportSize,
  formatFileSize,
  getMessagesToExport,
  getMessageTimestamp
} from "./utils.js";

export function exportChatToJson() {
  const messages = getMessagesToExport();

  if (!messages.length) {
    ui.notifications?.warn("No chat messages available to export.");
    return;
  }

  const exportMetadata = buildExportMetadata(messages);
  showExportOptionsDialog(messages, exportMetadata);
}

export function showExportOptionsDialog(messages, exportMetadata) {
  const dialogContent = `
    <form class="chat-exporter-plus-export-dialog">
      <p class="notes">
        Found ${exportMetadata.messageCount} messages since ${exportMetadata.earliestLabel}.<br>
        Choose which messages to include in the export.
      </p>
      <div class="form-group">
        <label for="chat-exporter-plus-whitespace-mode" title="Compact removes extra whitespace from message text to keep the export smaller." style="cursor:help;">
          Whitespace
        </label>
        <select name="whitespaceMode" id="chat-exporter-plus-whitespace-mode">
          <option value="compact">Compact</option>
          <option value="preserve">Preserve</option>
        </select>
      </div>
      <div class="form-group">
        <label for="chat-exporter-plus-filter-mode" title="Choose whether to export everything or reduce the selection to a date range or message count." style="cursor:help;">
          Filter mode
        </label>
        <select name="filterMode" id="chat-exporter-plus-filter-mode">
          <option value="all">Export all messages</option>
          <option value="date">Filter by date range</option>
          <option value="count">Filter by message count</option>
        </select>
      </div>
      <div id="chat-exporter-plus-date-filters" class="form-group" style="display:none;">
        <div class="form-group">
          <label for="chat-exporter-plus-start-date" title="Include messages from this date onward." style="cursor:help;">
            Start date
          </label>
          <input type="datetime-local" name="startDate" id="chat-exporter-plus-start-date">
        </div>
        <div class="form-group">
          <label for="chat-exporter-plus-end-date" title="Include messages up to and including this date." style="cursor:help;">
            End date
          </label>
          <input type="datetime-local" name="endDate" id="chat-exporter-plus-end-date">
        </div>
      </div>
      <div id="chat-exporter-plus-count-filters" class="form-group" style="display:none;">
        <div class="form-group">
          <label for="chat-exporter-plus-count-mode" title="Choose whether to export the earliest or latest messages." style="cursor:help;">
            Order
          </label>
          <select name="countMode" id="chat-exporter-plus-count-mode">
            <option value="first">First</option>
            <option value="last">Last</option>
          </select>
        </div>
        <div class="form-group">
          <label for="chat-exporter-plus-message-count" title="Set how many messages to include in the export." style="cursor:help;">
            Message count
          </label>
          <input type="number" name="messageCount" id="chat-exporter-plus-message-count" min="1" step="1" value="50">
        </div>
      </div>
      <div class="form-group">
        <label title="This estimate updates as you change the export options." style="cursor:help;">
          Est. file size
        </label>
        <div id="chat-exporter-plus-estimated-size">Calculating…</div>
      </div>
    </form>
  `;

  const DialogClass = foundry?.applications?.api?.DialogV2 ?? globalThis.DialogV2 ?? Dialog;
  let dialog;

  dialog = new DialogClass({
    window: {
      title: "Export chat messages"
    },
    content: dialogContent,
    buttons: [
      {
        action: "export",
        label: "Export",
        callback: () => {
          const form = resolveDialogForm(dialog?.element ?? dialog);
          if (!form) {
            return;
          }

          const options = collectExportOptions(form);
          const filteredMessages = filterMessagesForExport(messages, options);

          if (!filteredMessages.length) {
            ui.notifications?.warn("No messages matched the selected export filters.");
            return;
          }

          saveExportedMessages(filteredMessages, options.whitespaceMode);
        }
      },
      {
        action: "cancel",
        label: "Cancel",
        callback: () => {}
      }
    ],
    default: "export",
    modal: true,
    position: {
      width: 420
    }
  });

  const bindDialogControls = () => {
    const form = resolveDialogForm(dialog?.element ?? dialog);
    if (!form) {
      return;
    }

    const filterMode = form.querySelector("[name='filterMode']");
    const dateFilters = form.querySelector("#chat-exporter-plus-date-filters");
    const countFilters = form.querySelector("#chat-exporter-plus-count-filters");
    const estimatedSize = form.querySelector("#chat-exporter-plus-estimated-size");

    const updateFilterVisibility = () => {
      const selectedMode = filterMode?.value ?? "all";
      if (dateFilters) {
        dateFilters.style.display = selectedMode === "date" ? "block" : "none";
      }
      if (countFilters) {
        countFilters.style.display = selectedMode === "count" ? "block" : "none";
      }
    };

    const updateEstimatedSize = () => {
      if (!estimatedSize) {
        return;
      }

      const options = collectExportOptions(form);
      const filteredMessages = filterMessagesForExport(messages, options);
      const estimatedBytes = estimateExportSize(filteredMessages, options.whitespaceMode);
      estimatedSize.textContent = formatFileSize(estimatedBytes);
    };

    const handleDialogInput = (event) => {
      const target = event.target;
      if (!target || !(target instanceof HTMLElement)) {
        return;
      }

      const isRelevant = ["whitespaceMode", "filterMode", "startDate", "endDate", "countMode", "messageCount"].includes(target.name);
      if (!isRelevant) {
        return;
      }

      updateFilterVisibility();
      updateEstimatedSize();
    };

    const dialogRoot = dialog?.element;
    if (dialogRoot) {
      dialogRoot.removeEventListener("change", handleDialogInput);
      dialogRoot.removeEventListener("input", handleDialogInput);
      dialogRoot.addEventListener("change", handleDialogInput);
      dialogRoot.addEventListener("input", handleDialogInput);
    }

    updateFilterVisibility();
    updateEstimatedSize();
  };

  const renderDialog = async () => {
    try {
      await dialog.render(true);
    } catch (error) {
      console.warn("Failed to render export dialog", error);
    }

    requestAnimationFrame(() => bindDialogControls());
  };

  renderDialog();
}

export function resolveDialogForm(html) {
  if (!html) {
    return null;
  }

  if (html.querySelector) {
    return html;
  }

  if (html.element?.querySelector) {
    return html.element;
  }

  return html[0]?.querySelector ? html[0] : null;
}

export function collectExportOptions(form) {
  const filterMode = form.querySelector("[name='filterMode']")?.value ?? "all";
  const startDate = form.querySelector("[name='startDate']")?.value;
  const endDate = form.querySelector("[name='endDate']")?.value;
  const countMode = form.querySelector("[name='countMode']")?.value ?? "first";
  const messageCount = Number.parseInt(form.querySelector("[name='messageCount']")?.value ?? "0", 10);
  const whitespaceMode = form.querySelector("[name='whitespaceMode']")?.value ?? DEFAULT_WHITESPACE_MODE;

  const startTimestamp = startDate ? new Date(startDate).getTime() : null;
  const endTimestamp = endDate ? new Date(endDate).getTime() : null;

  return {
    filterMode,
    startTimestamp,
    endTimestamp,
    countMode,
    messageCount: Number.isFinite(messageCount) && messageCount > 0 ? messageCount : 1,
    whitespaceMode
  };
}

export function filterMessagesForExport(messages, options) {
  let filteredMessages = [...messages];

  if (options.filterMode === "date") {
    const startTimestamp = Number.isFinite(options.startTimestamp) ? options.startTimestamp : null;
    const endTimestamp = Number.isFinite(options.endTimestamp) ? options.endTimestamp : null;

    const lowerBound = startTimestamp ?? null;
    const upperBound = endTimestamp ?? null;

    filteredMessages = filteredMessages.filter((message) => {
      const timestamp = getMessageTimestamp(message);
      if (timestamp == null) {
        return false;
      }

      if (lowerBound != null && timestamp < lowerBound) {
        return false;
      }

      if (upperBound != null && timestamp > upperBound) {
        return false;
      }

      return true;
    });
  }

  if (options.filterMode === "count") {
    const safeCount = Math.max(1, options.messageCount ?? 1);
    filteredMessages = options.countMode === "last"
      ? filteredMessages.slice(-safeCount)
      : filteredMessages.slice(0, safeCount);
  }

  return filteredMessages;
}

export function saveExportedMessages(messages, whitespaceMode = DEFAULT_WHITESPACE_MODE) {
  const { blob } = buildExportPayload(messages, whitespaceMode);
  const filename = `fvtt-chat-exporter-plus-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

  if (typeof window.showSaveFilePicker === "function") {
    saveFileWithPicker(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function saveFileWithPicker(blob, filename) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: "JSON File",
          accept: {
            "application/json": [".json"]
          }
        }
      ]
    });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.warn("Failed to save JSON via file picker", error);
    }
  }
}
