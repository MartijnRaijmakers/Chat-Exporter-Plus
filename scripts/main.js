const MODULE_ID = "chat-exporter-plus";
const SETTING_HIDE_DEFAULT_EXPORT = "hideDefaultExportButton";
const SETTING_WHITESPACE_MODE = "whitespaceMode";
let ADDED_JSON_EXPORT_BUTTON = false;
let UPDATED_DEFAULT_EXPORT_BUTTON = false;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTING_HIDE_DEFAULT_EXPORT, {
    name: "Hide default Export Chat button",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      updateDefaultExportButtonHidden(ui.chat?.element);
      if (ui.chat?.render) {
        ui.chat.render();
      }
    }
  });

  game.settings.register(MODULE_ID, SETTING_WHITESPACE_MODE, {
    name: "Whitespace normalization",
    hint: "Choose how exported content is normalized. Compact collapses repeated whitespace in \"content\" values; preserve keeps all whitespace as-is, resulting in larger file size.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      compact: "Compact",
      preserve: "Preserve"
    },
    default: "compact",
    onChange: () => {
      if (ui.chat?.render) {
        ui.chat.render();
      }
    }
  });
});

Hooks.on("changeSidebarTab", (app) => {
    if (app.id === "chat") {
      AttachUi(app);
    }
});

Hooks.on("collapseSidebar", (sidebar, collapsed) => { 
    if (sidebar.tabGroups.primary === "chat" && !collapsed) {
      AttachUi(sidebar);
    }
});

function AttachUi(app) {
  if (!ADDED_JSON_EXPORT_BUTTON) {
    attachChatExportButton(app.element);
  }

  if (!UPDATED_DEFAULT_EXPORT_BUTTON) {
    updateDefaultExportButtonHidden(app.element);
  }
}

function attachChatExportButton(html) {
  ADDED_JSON_EXPORT_BUTTON = true;
  
  const controls = findControlButtonsContainer(html);
  if (!controls) {
    return;
  }

  const customButton = $(`
    <button
      type="button"
      class="ui-control icon fa-solid fa-file-brackets-curly"
      data-chat-exporter-plus="true"
      title="Export full Chat Log as JSON"
      aria-label="Export full Chat Log as JSON"
    />
  `);

  customButton.on("click", (event) => {
    event.preventDefault();
    exportChatToJson();
  });

  $(controls).prepend(customButton);

}

function updateDefaultExportButtonHidden(html) {
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

function findControlButtonsContainer(html) {
  return html.querySelector("#chat-controls > div.control-buttons");
}

function findExportButton(html) {
  return document.querySelector("#chat-controls > div.control-buttons > button[data-action='export']");
}

function exportChatToJson() {
  const messages = getMessagesToExport();

  if (!messages.length) {
    ui.notifications?.warn("No chat messages available to export.");
    return;
  }

  messages.map((message) => console.log(message)); // Debugging line to log each message

  const sanitizedMessages = messages.map((message) => ({
    ...message.toJSON(),
    content: sanitizeText(message.content ?? ""),
    rolls: JSON.parse(JSON.stringify(message.rolls ?? [])),
  }));

  const payload = {
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: sanitizedMessages
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
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

function getMessagesToExport() {
  if (game.messages?.contents) {
    return [...game.messages.contents];
  }

  if (ui.chat?.messages?.contents) {
    return [...ui.chat.messages.contents];
  }

  return Array.from(game.messages ?? []);
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function sanitizeText(value) {
  if (value == null) {
    return "";
  }

  const mode = game.settings.get(MODULE_ID, SETTING_WHITESPACE_MODE) ?? "compact";
  if (mode === "preserve") {
    return value;
  }

  return value.replace(/>\s+|\s+</g, function(m) {
    return m.trim();
  });
}

function serializeRolls(message) {
  const rolls = message.rolls ?? [];
  if (!rolls.length) {
    return [];
  }

  return rolls.map((roll) => {
    if (roll == null) {
      return null;
    }

    if (typeof roll === "string" || typeof roll === "number" || typeof roll === "boolean") {
      return roll;
    }

    if (typeof roll === "object") {
      if (typeof roll.toJSON === "function") {
        return roll.toJSON();
      }

      const clone = {};
      Object.entries(roll).forEach(([key, value]) => {
        if (value == null) {
          clone[key] = null;
        } else if (typeof value === "object") {
          try {
            clone[key] = JSON.parse(JSON.stringify(value));
          } catch (error) {
            clone[key] = String(value);
          }
        } else {
          clone[key] = value;
        }
      });
      return clone;
    }

    return String(roll);
  });
}
