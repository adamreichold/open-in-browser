/*

Copyright 2021-2022, 2024 Adam Reichold

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.

*/

async function* walkList(page) {
    for (const message of page.messages) {
        yield message;
    }

    while (page.id) {
        page = await browser.messages.continueList(page.id);

        for (const message of page.messages) {
            yield message;
        }
    }
}

async function* openSubFolders(folder, action) {
    for await (const messageId of action(folder)) {
        yield messageId;
    }

    for (const subFolder of folder.subFolders) {
        for await (const messageId of openSubFolders(subFolder, action)) {
            yield messageId;
        }
    }
}

async function* openUnread(folder) {
    const page = await browser.messages.query({
        folder: folder,
        unread: true
    });

    for await (const message of walkList(page)) {
        yield message.id;
    }
}

async function* openSelected(tabId) {
    const page = await browser.mailTabs.getSelectedMessages(tabId);

    for await (const message of walkList(page)) {
        yield message.id;
    }
}

async function openInBrowser(messageId) {
    const message = await browser.messages.getFull(messageId);

    const contentBase = message.headers["content-base"];
    if (contentBase === undefined) {
        return;
    }
    for (let url of contentBase) {
        browser.windows.openDefaultBrowser(url);
    }

    browser.messages.update(messageId, {
        read: true
    });
}

browser.menus.create({
    id: "openUnread",
    title: "Open unread in browser",
    contexts: ["folder_pane"],
    async onclick(info) {
        for await (const messageId of openSubFolders(info.selectedFolder, openUnread)) {
            openInBrowser(messageId);
        }
    },
});

browser.menus.create({
    id: "openSelected",
    title: "Open selected in browser",
    contexts: ["message_list"],
    async onclick(info, tab) {
        for await (const messageId of openSelected(tab.id)) {
            openInBrowser(messageId);
        }
    },
});

browser.menus.onShown.addListener(async function (info) {
    let account = null;
    if (info.contexts.includes("message_list") && info.displayedFolder) {
        account = await browser.accounts.get(info.displayedFolder.accountId);
    } else if (info.contexts.includes("folder_pane") && info.selectedFolder) {
        account = await browser.accounts.get(info.selectedFolder.accountId);
    }

    const isRss = account?.type == "rss";

    browser.menus.update("openUnread", { visible: isRss });
    browser.menus.update("openSelected", { visible: isRss });
    browser.menus.refresh();
});
