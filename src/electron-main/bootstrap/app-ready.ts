import electronLog from "electron-log";
import {app} from "electron";

import {Context} from "src/electron-main/model";
import {getDefaultSession, initSession} from "src/electron-main/session";
import {initApi} from "src/electron-main/api";
import {initApplicationMenu} from "src/electron-main/menu";
import {initMainBrowserWindow} from "src/electron-main/window/main";
import {initNativeThemeNotification} from "src/electron-main/native-theme";
import {initSpellCheckController} from "src/electron-main/spell-check/controller";
import {initTray} from "src/electron-main/tray";
import {initWebContentsCreatingHandlers} from "src/electron-main/web-contents";
import {registerWebFolderFileProtocol} from "src/electron-main/protocol";
import {setUpPowerMonitorNotification} from "src/electron-main/power-monitor";

export async function appReadyHandler(ctx: Context): Promise<void> {
    registerWebFolderFileProtocol(ctx, getDefaultSession());

    await initSession(ctx, getDefaultSession());

    const endpoints = await initApi(ctx);

    // so consequent "ctx.configStore.readExisting()" calls don't fail since "endpoints.readConfig()" call initializes the config
    const {spellCheckLocale, customTrayIconColor, logLevel, themeSource} = await endpoints.readConfig();

    // TODO test "logger.transports.file.level" update
    electronLog.transports.file.level = logLevel;

    initNativeThemeNotification(themeSource);

    await (async (): Promise<void> => {
        const spellCheckController = await initSpellCheckController(spellCheckLocale);
        ctx.getSpellCheckController = (): typeof spellCheckController => spellCheckController;
    })();

    // TODO test "initWebContentsCreatingHandlers" called after "ctx.getSpellCheckController" got initialized
    await initWebContentsCreatingHandlers(ctx);

    ctx.uiContext = {
        browserWindow: await initMainBrowserWindow(ctx),
        tray: await initTray(ctx),
        appMenu: await initApplicationMenu(ctx),
    };

    setUpPowerMonitorNotification();

    await endpoints.updateOverlayIcon({hasLoggedOut: false, unread: 0, trayIconColor: customTrayIconColor});

    app.on("second-instance", async () => endpoints.activateBrowserWindow());
    app.on("activate", async () => endpoints.activateBrowserWindow());
}
