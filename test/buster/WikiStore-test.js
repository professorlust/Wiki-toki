/*global describe, it, beforeEach, afterEach */

var Q = require("q"),
    buster = require("buster"),
    fse = require("fs-extra"),
    path = require("path");
var WikiStore = require("../../lib/WikiStore.js"),
    storeUpgrader = require("../../lib/storeUpgrader");

buster.spec.expose();
var expect = buster.expect;

describe("Retrieval", function() {
    beforeEach(function() {
        this.store = new WikiStore({
            storeDirectory: "test/buster/stores/simple"
        });
    });

    it("should return an error for non-existing pages", function() {
        var store = this.store;
        return store.readPage("WikiIndexx").fail(function(err) {
            expect(err).not.toEqual(null);

            return store.readPage("WikiIndex");
        });
    });

    it("should retrieve existing pages", function() {
        return this.store.readPage("WikiIndex").then(function(text) {
            expect(text).toEqual("This is the index\n");
        });
    });
});

describe("Page save", function() {
    var storeDir = "test/buster/stores/save";

    beforeEach(function() {
        fse.removeSync(storeDir);
        fse.mkdirSync(storeDir);
        fse.writeFileSync(path.join(storeDir, "WikiIndex"),
                          "Index intentionally (almost) blank.");
        storeUpgrader.upgrade(storeDir);
    });

    it("should create pages", function() {
        var store = new WikiStore({
            storeDirectory: storeDir
        });
        var pageContents = "New page\n";

        return store.writePage("WikiIndex", pageContents).then(function() {
            return store.readPage("WikiIndex");
        }).then(function(text) {
            expect(text).toEqual(pageContents);
        });
    });

    it("should modify already-existing pages", function() {
        var store = new WikiStore({
            storeDirectory: storeDir
        });
        var contents1 = "New page\n",
            contents2 = "Modified page\n";

        return store.writePage("WikiIndex", contents1).then(function() {
            return store.writePage("WikiIndex", contents2);
        }).then(function() {
            return store.readPage("WikiIndex");
        }).then(function(text) {
            expect(text).toEqual(contents2);
        });
    });
});

describe("Page info", function() {
    it("should return an error on non-existing store", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/non-existent"
        });

        return store.getPageInfo().fail(function(err) {
            expect(err).not.toEqual(null);
        });
    });

    it("should return relevant info on an existing store", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/trivial"
        });

        return store.getPageInfo().then(function(pageInfoArray) {
            var sortedPageInfoArray = pageInfoArray.sort(function(a, b) {
                return a.title.localeCompare(b.title);
            });

            expect(sortedPageInfoArray[0].title).toEqual("SomethingElse");
            expect(sortedPageInfoArray[0].contents).toEqual("Some other content\n");
            expect(sortedPageInfoArray[1].title).toEqual("WikiIndex");
            expect(sortedPageInfoArray[1].contents).toEqual("Index page\n");
        });
    });
});

describe("Title search", function() {
    it("should return no results on empty search term", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/trivial"
        });

        return store.searchTitles("").then(function(results) {
            expect(results).toEqual([]);
        });
    });

    it("should find single result on one-term search", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/trivial"
        });

        return store.searchTitles("index").then(function(results) {
            expect(results).toEqual(["WikiIndex"]);
        });
    });

    it("should find multiple results on one-term search", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/simple"
        });

        return store.searchTitles("w").then(function(results) {
            expect(results.sort()).toEqual(["OswaldoPetterson", "WikiIndex"]);
        });
    });

    it("should find results that have ALL search terms", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/simple"
        });

        return store.searchTitles("w i").then(function(results) {
            expect(results).toEqual(["WikiIndex"]);
        });
    });
});

describe("Content search", function() {
    it("should return no results on empty search term", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/content-search"
        });

        return store.searchContents("").then(function(results) {
            expect(results).toEqual([]);
        });
    });

    it("should find single result on a simple, one-term search", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/content-search"
        });

        return store.searchContents("front").then(function(results) {
            expect(results).toEqual(["WikiIndex"]);
        });
    });

    it("should find single results regarless of casing", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/content-search"
        });

        return store.searchContents("FRoNt").then(function(results) {
            expect(results).toEqual(["WikiIndex"]);
        });
    });

    it("should only find full words", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/content-search"
        });

        return store.searchContents("fro").then(function(results) {
            expect(results).toEqual([]);
        });
    });

    it("should not allow the user to sabotage the regular expression", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/content-search"
        });

        return store.searchContents("front\\").then(function(results) {
            expect(results).toEqual(["WikiIndex"]);
        });
    });

    it("should allow the user to use regular expressions", function() {
        var store = new WikiStore({
            storeDirectory: "test/buster/stores/content-search"
        });

        return store.searchContents("front.*").then(function(results) {
            expect(results.sort()).toEqual(["ProgrammingLanguages", "WikiIndex"]);
        });
    });
});

describe("Rename page", function() {
    var origDir = "test/buster/stores/simple",
        targetDir = "test/buster/stores/rename",
        self = this;

    beforeEach(function(done) {
        fse.copy(origDir, targetDir, function(err) {
            if (err) {
                throw new Error("Could not prepare store: " + err);
            }

            self.store = new WikiStore({
                storeDirectory: targetDir
            });

            done();
        });
    });

    afterEach(function(done) {
        fse.remove(targetDir, function(err) {
            if (err) {
                throw new Error("Could not delete store: " + err);
            }
            done();
        });
    });

    it("should fail if the target page already exists", function() {
        var self = this,
            origName = "IdontHaveDoubleU",
            targetName = "OswaldoPetterson";

        return self.store.renamePage(origName, targetName).fail(function() {
            return self.store.pageExists(origName);
        }).then(function(res) {
            expect(res).toEqual(true);
        });
    });

    it("should fail to rename WikiIndex", function() {
        return this.store.renamePage("WikiIndex", "WhateverElse").fail(function(err) {
            expect(err).not.toEqual(null);
        });
    });

    it("should fail if the original page doesn't exist", function() {
        var self = this;

        return self.store.renamePage("BlahBlah", "BlehBleh").fail(function(err) {
            expect(err).not.toEqual(null);

            return self.store.pageExists("BlehBleh");
        }).then(function(res) {
            expect(res).toEqual(false);
        });
    });

    it("should rename pages if the new name doesn't exist", function(done) {
        var self = this,
            origName = "IdontHaveDoubleU",
            targetName = "IdontHaveW";

        self.store.renamePage(origName, targetName).then(function() {
            return self.store.pageExists(origName);
        }).then(function(res) {
            expect(res).toEqual(false);

            return self.store.pageExists(targetName);
        }).then(function(res) {
            expect(res).toEqual(true);

            self.store.readPage(targetName).then(function(text) {
                expect(text).toEqual("I don't have that letter!\n");
                done();
            });
        });
    });
});

describe("Share page", function() {
    var origDir = "test/buster/stores/simple",
        targetDir = "test/buster/stores/sharing",
        self = this;

    beforeEach(function(done) {
        fse.copy(origDir, targetDir, function(err) {
            if (err) {
                throw new Error("Could not prepare store: " + err);
            }

            self.store = new WikiStore({
                storeDirectory: targetDir
            });

            done();
        });
    });

    afterEach(function(done) {
        fse.remove(targetDir, function(err) {
            if (err) {
                throw new Error("Could not delete store: " + err);
            }
            done();
        });
    });

    it("should be able to mark a page as shared", function() {
        var self = this,
            pageName = "IdontHaveDoubleU",
            expectedUuid;

        return self.store.sharePage(pageName).then(function(uuid) {
            expect(uuid.length).toEqual(36);
            expectedUuid = uuid;
            return self.store.pageShareId(pageName);
        }).then(function(actualUuid) {
            expect(actualUuid).toEqual(expectedUuid);
        });
    });

    it("should reuse the same share id when sharing an already shared page", function() {
        var self = this,
            pageName = "IdontHaveDoubleU",
            initialShareId;

        return self.store.sharePage(pageName).then(function(shareId) {
            initialShareId = shareId;
            return self.store.sharePage(pageName);
        }).then(function(shareId) {
            expect(shareId).toEqual(initialShareId);
        });
    });

    it("should be able to check if a page is shared", function() {
        var self = this,
            pageName = "IdontHaveDoubleU";

        return self.store.isPageShared(pageName).then(function(isSharedInitially) {
            expect(isSharedInitially).toEqual(false);

            return self.store.sharePage(pageName);
        }).then(function(/*uuid*/) {
            return self.store.isPageShared(pageName);
        }).then(function(isSharedNow) {
            expect(isSharedNow).toEqual(true);
        });
    });

    it("should be able to remove a page share", function() {
        var self = this,
            pageName = "IdontHaveDoubleU";

        return self.store.isPageShared(pageName).then(function(isSharedInitially) {
            expect(isSharedInitially).toEqual(false);

            return self.store.sharePage(pageName);
        }).then(function(/*uuid*/) {
            return self.store.unsharePage(pageName);
        }).then(function() {
            return self.store.isPageShared(pageName);
        }).then(function(isSharedNow) {
            expect(isSharedNow).toEqual(false);
        });
    });

    it("should return error when unsharing if the page is not shared", function() {
        var self = this,
            pageName = "IdontHaveDoubleU";

        return self.store.isPageShared(pageName).then(function(isSharedInitially) {
            expect(isSharedInitially).toEqual(false);

            return self.store.unsharePage(pageName);
        }).then(function() {
            expect("no error").toEqual("this should have been an error");
        }).catch(function(err) {
            expect(err).not.toEqual(null);
        });
    });

    it("should assign a different share id every time a page is shared", function() {
        var self = this,
            pageName = "IdontHaveDoubleU",
            firstShareId,
            newShareId;

        return self.store.sharePage(pageName, function(err, shareId) {
            expect(err).toEqual(null);
            firstShareId = shareId;
            return self.store.unsharePage(pageName);
        }).then(function() {
            return self.store.sharePage(pageName);
        }).then(function(shareId) {
            expect(shareId).not.toEqual(firstShareId);
            newShareId = shareId;
            return self.store.pageShareId(pageName);
        }).then(function(lastShareId) {
            expect(lastShareId).toEqual(newShareId);
        });
    });

    it("should give a list of shared pages", function() {
        var self = this,
            pageName = "IdontHaveDoubleU",
            shareId;

        return self.store.getSharedPages().then(function(sharedPageList) {
            expect(Object.keys(sharedPageList).length).toEqual(0);

            return self.store.sharePage(pageName);
        }).then(function(id) {
            shareId = id;
            return self.store.getSharedPages();
        }).then(function(sharedPageList) {
            expect(sharedPageList[pageName]).toEqual(shareId);

            return self.store.unsharePage(pageName);
        }).then(function() {
            return self.store.getSharedPages();
        }).then(function(sharedPageList) {
            expect(Object.keys(sharedPageList).length).toEqual(0);
        });
    });

    it("should be able to retrieve the page name for a share id", function() {
        var self = this,
            pageName = "OswaldoPetterson";

        return self.store.sharePage(pageName).then(function(shareId) {
            return self.store.pageNameForShareId(shareId);
        }).then(function(actualPageName) {
            expect(actualPageName).toEqual(pageName);
        });
    });

    it("should be able to reach a renamed page with the same share id", function() {
        var self = this,
            pageName = "OswaldoPetterson",
            newPageName = "OswaldoSamuelson",
            shareId;

        return self.store.sharePage(pageName).then(function(id) {
            shareId = id;
            return self.store.renamePage(pageName, newPageName);
        }).then(function() {
            return self.store.pageNameForShareId(shareId);
        }).then(function(actualPageName) {
            expect(actualPageName).toEqual(newPageName);
        });
    });
});

describe("Attachments", function() {
    var origDir = "test/buster/stores/simple",
        targetDir = "test/buster/stores/attachments",
        self = this;

    beforeEach(function(done) {
        fse.copy(origDir, targetDir, function(err) {
            if (err) {
                throw new Error("Could not prepare store: " + err);
            }

            self.store = new WikiStore({
                storeDirectory: targetDir
            });

            done();
        });
    });

    afterEach(function(done) {
        fse.remove(targetDir, function(err) {
            if (err) {
                throw new Error("Could not delete store: " + err);
            }
            done();
        });
    });

    it("should have no attachments by default", function() {
        return self.store.getAttachmentList("WikiIndex").then(function(attachments) {
            expect(attachments).toEqual([]);
        });
    });

    it("should reject the promise to get attachments for non-existent pages", function() {
        var success = null;

        return self.store.getAttachmentList("NonExistentPage").then(function() {
            success = false;
        }).catch(function() {
            success = true;
        }).then(function() {
            expect(success).toEqual(true);
        });
    });

    it("should be created and retrieved", function() {
        var attachmentName = "foobar.txt",
            attachmentContents = "foobar is a very nice file",
            tmpPath = path.join(targetDir, "xxx");

        fse.writeFileSync(tmpPath, attachmentContents);

        return self.store.addAttachment("WikiIndex", attachmentName, tmpPath).then(function() {
            return self.store.getAttachmentList("WikiIndex");
        }).then(function(attachments) {
            var attachmentNames = attachments.map(function(attachment) {
                return attachment.filename;
            });
            expect(attachmentNames).toEqual([attachmentName]);

            return self.store.getAttachmentPath("WikiIndex", attachmentName);
        }).then(function(path) {
            return Q.nfcall(fse.readFile, path);
        }).then(function(contents) {
            expect(contents.toString()).toEqual(attachmentContents);
        });
    });

    it("should not be tricked by paths when writing attachments", function() {
        var attachmentBaseName = "lol.txt",
            attachmentName = "../" + attachmentBaseName,
            tmpPath = path.join(targetDir, "xxx");

        fse.writeFileSync(tmpPath, "lol");

        return self.store.addAttachment("WikiIndex", attachmentName, tmpPath).then(function() {
            return self.store.getAttachmentList("WikiIndex");
        }).then(function(attachments) {
            var attachmentNames = attachments.map(function(attachment) {
                return attachment.filename;
            });
            expect(attachmentNames).toEqual([attachmentBaseName]);
        });
    });

    it("should not be tricked by paths when reading attachments", function() {
        var attachmentBaseName = "contents",
            attachmentName = "../" + attachmentBaseName,
            attachmentContents = "Some test contents",
            tmpPath = path.join(targetDir, "xxx");

        fse.writeFileSync(tmpPath, attachmentContents);

        return self.store.addAttachment("WikiIndex", attachmentName, tmpPath).then(function() {
            return self.store.getAttachmentPath("WikiIndex", attachmentName);
        }).then(function(path) {
            return Q.nfcall(fse.readFile, path);
        }).then(function(contents) {
            expect(contents.toString()).toEqual(attachmentContents);
        });
    });

    it("should return file size and modification time", function() {
        var attachmentName = "foo.txt",
            attachmentContents = "This is a fake, testing file",
            contentsSize = attachmentContents.length,
            nowInSeconds = Math.floor(new Date().getTime() / 1000),
            tmpPath = path.join(targetDir, "xxx");

        fse.writeFileSync(tmpPath, attachmentContents);

        return self.store.addAttachment("WikiIndex", attachmentName, tmpPath).then(function() {
            return self.store.getAttachmentList("WikiIndex");
        }).then(function(attachments) {
            var mtimeEpoch = attachments[0].mtime.getTime() / 1000;
            expect(attachments[0].size).toEqual(contentsSize);
            expect(mtimeEpoch).not.toBeLessThan(nowInSeconds);
            expect(mtimeEpoch).toBeLessThan(nowInSeconds + 3);
        });
    });

    it("should overwrite previous attachments with the same name", function() {
        var attachmentName = "foo.txt",
            originalContents = "Original contents",
            updatedContents = "Updated contents",
            origTmpPath = path.join(targetDir, "xxx"),
            updatedTmpPath = path.join(targetDir, "yyy");

        fse.writeFileSync(origTmpPath, originalContents);
        fse.writeFileSync(updatedTmpPath, updatedContents);

        return self.store.addAttachment(
            "WikiIndex",
            attachmentName,
            origTmpPath
        ).then(function() {
            return self.store.addAttachment("WikiIndex",
                                            attachmentName,
                                            updatedTmpPath);
        }).then(function() {
            return self.store.getAttachmentList("WikiIndex");
        }).then(function(attachments) {
            var attachmentNames = attachments.map(function(attachment) {
                return attachment.filename;
            });
            expect(attachmentNames).toEqual([attachmentName]);

            return self.store.getAttachmentPath("WikiIndex", attachmentName);
        }).then(function(path) {
            return Q.nfcall(fse.readFile, path);
        }).then(function(contents) {
            expect(contents.toString()).toEqual(updatedContents);
        });
    });

    it("should delete attachments", function() {
        var attachmentName = "foo.txt",
            attachmentContents = "foobar",
            attachmentPath = path.join(targetDir, "xxx");

        fse.writeFileSync(attachmentPath, attachmentContents);

        return self.store.addAttachment(
            "WikiIndex",
            attachmentName,
            attachmentPath
        ).then(function() {
            return self.store.deleteAttachment("WikiIndex", attachmentName);
        }).then(function() {
            return self.store.getAttachmentList("WikiIndex");
        }).then(function(attachments) {
            expect(attachments).toEqual([]);
        });
    });

    it("should return an error when deleting a non-exsting attachment", function() {
        var success = null;

        return self.store.deleteAttachment(
            "WikiIndex",
            "idontexist.txt"
        ).then(function() {
            success = false;
        }).catch(function() {
            success = true;
        }).then(function() {
            expect(success).toEqual(true);
        });
    });

    it("renaming a page makes it keep its attachments", function() {
        var pageName = "OswaldoPetterson",
            newPageName = "RenamedWikiPage",
            attachmentName = "foo.txt",
            attachmentPath = path.join(targetDir, "xxx");

        fse.writeFileSync(attachmentPath, "foobar");

        return self.store.addAttachment(
            pageName,
            attachmentName,
            attachmentPath
        ).then(function() {
            return self.store.renamePage(pageName, newPageName);
        }).then(function() {
            return self.store.getAttachmentList(newPageName);
        }).then(function(attachments) {
            expect(attachments.length).toEqual(1);
            expect(attachments[0].filename).toEqual(attachmentName);
        }).then(function() {
            return self.store.getAttachmentList(pageName);
        }).fail(function(err) {
            expect(err).not.toEqual(null);
        });
    });
});
