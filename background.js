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
        for await (const messageId of openSubFolders(subFolder)) {
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
    title: "Open unread",
    contexts: ["folder_pane"],
    async onclick(info) {
        for await (const messageId of openSubFolders(info.selectedFolder, openUnread)) {
            openInBrowser(messageId);
        }
    },
});

browser.menus.create({
    id: "openSelected",
    title: "Open selected",
    contexts: ["folder_pane"],
    async onclick(info, tab) {
        for await (const messageId of openSelected(tab.id)) {
            openInBrowser(messageId);
        }
    },
});

browser.menus.onShown.addListener(async function (info) {
    const accountId = info.selectedFolder.accountId;
    const account = await browser.accounts.get(accountId);
    const isRss = account.type == "rss";

    browser.menus.update("openUnread", { visible: isRss });
    browser.menus.update("openSelected", { visible: isRss });
    browser.menus.refresh();
});
