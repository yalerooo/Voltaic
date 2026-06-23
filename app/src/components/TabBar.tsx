// Advanced tab strip across the top of the content area. New-tab button opens a
// local terminal; tabs are closable and reflect the active selection.

import { useAppStore } from "../store/appStore";
import "./TabBar.css";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, openTab } = useAppStore();

  return (
    <div className="tabbar">
      <div className="tabbar__tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={
              "tabbar__tab" + (tab.id === activeTabId ? " is-active" : "")
            }
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={tab.id === activeTabId}
          >
            <span className="tabbar__dot" data-kind={tab.kind} />
            <span className="tabbar__title">{tab.title}</span>
            <button
              className="tabbar__close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              aria-label="Close tab"
              data-tooltip="Close tab"
              data-tooltip-pos="bottom"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="tabbar__new"
        onClick={() =>
          openTab({ title: "Terminal", kind: "terminal", shell: "default" })
        }
        aria-label="New terminal tab"
        data-tooltip="New terminal"
        data-tooltip-pos="bottom"
      >
        +
      </button>
    </div>
  );
}
