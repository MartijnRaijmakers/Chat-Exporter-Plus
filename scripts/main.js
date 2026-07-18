import { MODULE_ID, SETTING_HIDE_DEFAULT_EXPORT } from "./constants.js";
import { AttachUi, updateDefaultExportButtonHidden } from "./ui.js";

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
