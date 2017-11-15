/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/**
 * @params win {Object} ChromeWindow
 */
(function (win) {
"use strict";

if (!win.TabSplit) {
  win.TabSplit = {};
}
const TabSplit = win.TabSplit;

TabSplit.view = {
  ID_TABSPLIT_BUTTON: "tabsplit-button",

  PX_COLUMN_SPLITTER_WIDTH: 8,

  // Hold the state got from the store
  _state: null,

  // The column splitter
  _cSplitter: null,

  // <xul:tabpanels anonid="panelcontainer">
  _panelContainer: null,

  /**
   * @params params {Object}
   *    - store {Objec} TabSplit.store
   *    - utils {Object} TabSplit.utils
   *    - gBrowser {XULELement} <tabbrowser>
   *    - listener {Object} a object with event handling functions
   */
  init(params) {
    let { store, utils, gBrowser, listener } = params;
    this._utils = utils;
    this._gBrowser = gBrowser;
    this._store = store;
    this._listener = listener;
    this._state = this._store.getState();
    this._store.subscribe(this);
    this._addTabSplitButton();
  },

  _addTabSplitButton(onClick) {
    if (!CustomizableUI.getPlacementOfWidget(this.ID_TABSPLIT_BUTTON)) {
      console.log('TMP> tabsplit-view - Creating customizable wisget');
      CustomizableUI.createWidget({
        id: this.ID_TABSPLIT_BUTTON,
        type: "button",
        tooltiptext: "Let's split tabs!!!",
        defaultArea: "nav-bar",
        localized: false,
        onCommand: e => this._listener.onTabSplitButtonClick()
      });
      // Explicitly put the button on the nav bar
      CustomizableUI.addWidgetToArea("tabsplit-button", "nav-bar")
    }
  },

  _removeTabSplitButton() {
    // TODO
  },

  _initTabbrowser() {
    console.log("TMP> tabsplit-view - _initTabbrowser");

    // The `-moz-stack` display enables rendering multiple web pages at the same time.
    // Howevre, the active web page may be covered by inactive pages on top of the stack
    // so have to hide inactive pages to reveal the active page.
    let selectedPanel = this._gBrowser.selectedTab.linkedPanel;
    let boxes = this._utils.getNotificationboxes();
    boxes.forEach(box => {
      if (box.id != selectedPanel) {
        box.style.visibility = "hidden";
      }
    });
    this._panelContainer = document.getAnonymousElementByAttribute(this._gBrowser, "anonid", "panelcontainer");
    this._panelContainer.style.display = "-moz-stack";

    // Append the splitter
    let appContent = this._gBrowser.parentNode;
    this._cSplitter = document.createElement("vbox");
    this._cSplitter.classList.add("tabsplit-column-splitter");
    this._cSplitter.style.width = this.PX_COLUMN_SPLITTER_WIDTH + "px";
    appContent.classList.add("tabsplit-spliter-container");
    appContent.appendChild(this._cSplitter);
    
    this._gBrowser.setAttribute("data-tabsplit-tabbrowser-init", "true");
  },

  _refreshTabbrowser() {
    console.log("TMP> tabsplit-view - _refreshTabbrowser");

    let selectedPanel = this._state.selectedLinkedPanel;
    let selectedGroup = this._utils.getTabGroupByLinkedPanel(selectedPanel, this._state);
    let activePanels = [ selectedPanel ];
    if (selectedGroup) {
      // Now the selected tab is in one tab-split group,
      // so there are multiple active panels.
      activePanels = selectedGroup.tabs.map(tab => tab.linkedPanel);
    }

    let boxes = this._utils.getNotificationboxes();
    boxes.forEach(box => {
      let browser = this._utils.getBrowserByNotificationbox(box);
      let isActive = browser.docShellIsActive;
      // Below only set the docShell state when finding the inconsistency,
      // because that operation is expensive.
      console.log("TMP> tabsplit-view - _refreshTabbrowser - box.id, isActive =", box.id, isActive);
      if (activePanels.includes(box.id)) {
        box.style.visibility = "visible";
        if (isActive == false) {
          console.log("TMP> tabsplit-view - _refreshTabbrowser - set docShellIsActive to true for ", box.id);
          browser.docShellIsActive = true;
        }
      } else {
        box.style.visibility = "hidden";
        if (isActive == true) {
          browser.docShellIsActive = false;
        }
      }
    });
  },

  _uninitTabbrowser() {
    // TODO
  },

  _setTabGroupFocus() {
    let selectedPanel = this._state.selectedLinkedPanel;
    let selectedGroup = this._utils.getTabGroupByLinkedPanel(selectedPanel, this._state);
    if (selectedGroup) {
      console.log("TMP> tabsplit-view - _switchFocus");
      selectedGroup.tabs.forEach(tabState => {
        let box = this._utils.getNotificationboxByLinkedPanel(tabState.linkedPanel);
        if (tabState.linkedPanel == selectedPanel) {
          box.classList.add("tabsplit-focus");
        } else {
          box.classList.remove("tabsplit-focus");
        }
      });
    }
  },

  _clearTabGroupFocus() {
    // TODO
  },

  _setTabGroupStyle(id) {
    let color = this._state.tabGroups[id].color;
    let tabStates = this._state.tabGroups[id].tabs;
    let len = tabStates.length;
    for (let i = 0; i < len; i++) {
      let tab = this._utils.getTabByLinkedPanel(tabStates[i].linkedPanel);
      tab.setAttribute("data-tabsplit-tab-group-id", id);
      tab.classList.add("tabsplit-tab");
      if (i == 0) {
        tab.classList.add("tabsplit-tab-first");
      } else if (i == len - 1) {
        tab.classList.add("tabsplit-tab-last");
      }
      tab.style.borderColor = color;
    }
  },

  _clearTabGroupStyle() {
    // TODO
  },

  _refreshTabDistributions() {
    console.log("TMP> tabsplit-view - _refreshTabDistributions");
    let selectedPanel = this._state.selectedLinkedPanel;
    let selectedGroup = this._utils.getTabGroupByLinkedPanel(selectedPanel, this._state);
    if (selectedGroup) {
      let areas = selectedGroup.tabs.map(tabState => {
        let { linkedPanel, distribution } = tabState;
        return {
          distribution,
          box: this._utils.getNotificationboxByLinkedPanel(linkedPanel),
        };
      });
      let [ left, right ] = areas;
      // Resize the notificationboxs
      let availableWidth = this._state.windowWidth - this.PX_COLUMN_SPLITTER_WIDTH;
      left.width = availableWidth * left.distribution;
      right.width = availableWidth - left.width;
      left.box.style.marginRight = (this._state.windowWidth - left.width) + "px";
      right.box.style.marginLeft = (this._state.windowWidth - right.width) + "px";
      // Position the splitter
      this._cSplitter.style.left = left.width + "px";
      this._cSplitter.style.display = "block";
    } else {
      // No tab being split is selceted so no splitter either.
      this._cSplitter.style.display = "none";
    }
  },

  _clearTabDistributions() {
    // TODO
  },

  async _orderTabPositions() {
    let tabGroupIds = this._state.tabGroupIds;
    if (tabGroupIds.length <= 0) {
      return;
    }
    console.log("TMP> tabsplit-view - _orderTabPositions");
    // Organize tabs order on the browser UI so that
    // 1. pinned tabs come first
    // 2. tabs split per tab groups' order come next, a left tab comes before a right tab.
    // 3. other usual tabs come finally
    //
    // Firstly, calculate the expected indexes for tabs split
    let expIndex = this._utils.getLastPinnedTabIndex();
    let expectations = [];
    tabGroupIds.forEach(id => {
      let [ t0, t1 ] = this._state.tabGroups[id].tabs;
      expectations.push([ t0.linkedPanel, ++expIndex ]);
      expectations.push([ t1.linkedPanel, ++expIndex ]);
    });

    // Second, move tabs to right positions if not as expected
    for (let i = 0; i < expectations.length; i++) {
      await new Promise(resolve => {
        let [ linkedPanel, pos ] = expectations[i];
        if (this._gBrowser.visibleTabs[pos].linkedPanel == linkedPanel) {
          resolve();
          return;
        }
        let tab = this._utils.getTabByLinkedPanel(linkedPanel);
        tab.addEventListener("TabMove", resolve, { once: true });
        this._gBrowser.moveTabTo(tab, pos);
      });
    }
  },

  _clearTabPositions() {
    // TODO
  },

  update(newState, tabGroupsDiff) {
    console.log("TMP> tabsplit-view - new state comes", newState, tabGroupsDiff);

    if (this._state.status == "status_destroyed") {
      throw "The current status is destroyed, please init again before updating any view";
    }

    let oldState = this._state;
    console.log("TMP> tabsplit-view - old state", oldState);
    this._state = newState;
    let { status, windowWidth, selectedLinkedPanel } = this._state;
    if (status != oldState.status) {
      switch (status) {
        case "status_inactive":
          // TODO: deactivate
          return;

        case "status_destroyed":
          // TODO: Destroy
          return;

        case "status_active":
          this._initTabbrowser();
          break;
      }
    } else if (status == "status_inactive") {
      // The current status is inactive
      // so return after saving the new state
      // but we still leave a message in case of debugging.
      console.warn(
        "Updating view under the inactive status has no effect. " +
        "If you really want to update view, please activate the status first."
      );
      return;
    }

    let changes = new Set();
    if (windowWidth !== oldState.windowWidth) {
      changes.add("windowWidth");
    }
    if (selectedLinkedPanel !== oldState.selectedLinkedPanel) {
      changes.add("selectedLinkedPanel");
    }

    let { added, removed, updated } = tabGroupsDiff;
    if (removed.length > 0) {
      // TODO: Recover tabs
    }

    added.forEach(id => this._setTabGroupStyle(id));

    if (updated.length > 0) {
      // TODO: Maybe this is useless
    }

    // TODO: When clicking another visible browser,
    // the selceted browser should change accordingly <= the control's duty
    this._refreshTabbrowser();
    this._setTabGroupFocus();

    if (changes.add("windowWidth")) {
      // TODO: Maybe this is useless
    }

    this._refreshTabDistributions();
    this._orderTabPositions();
  },

  onStateChange(store, tabGroupsDiff) {
    console.log("TMP> tabsplit-view - onStateChange");
    win.requestAnimationFrame(() => this.update(store.getState(), tabGroupsDiff));
  }
};

})(this);