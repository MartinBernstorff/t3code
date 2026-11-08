import { ChevronDownIcon } from "lucide-react";

import {
  getClientSettings,
  updateClientSettings,
  useClientSettings,
} from "../../hooks/useSettings";
import {
  isDefaultSidebarThreadRowVisibility,
  resolveSidebarThreadRowVisibility,
  setSidebarThreadRowItem,
  SIDEBAR_THREAD_ROW_ITEMS,
} from "../sidebar/sidebarThreadRowItems";
import { Button } from "../ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuTrigger,
} from "../ui/menu";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function SidebarThreadRowItemsRow() {
  const visibility = useClientSettings(resolveSidebarThreadRowVisibility);
  const enabled = SIDEBAR_THREAD_ROW_ITEMS.filter((item) => visibility[item.id]).length;
  return (
    <SettingsRow
      {...searchableSetting("sidebar-thread-row-items")}
      description="Choose what each thread in the sidebar shows besides its title and status."
      resetAction={
        isDefaultSidebarThreadRowVisibility(visibility) ? null : (
          <SettingResetButton
            label="sidebar thread rows"
            onClick={() => updateClientSettings({ sidebarThreadRowItems: {} })}
          />
        )
      }
      control={
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between sm:w-40"
                aria-label={`Sidebar thread rows: ${enabled} of ${SIDEBAR_THREAD_ROW_ITEMS.length} on`}
              />
            }
          >
            {enabled} of {SIDEBAR_THREAD_ROW_ITEMS.length} on
            <ChevronDownIcon aria-hidden />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuGroup>
              <MenuGroupLabel>Show in sidebar threads</MenuGroupLabel>
              {SIDEBAR_THREAD_ROW_ITEMS.map((item) => (
                <MenuCheckboxItem
                  key={item.id}
                  checked={visibility[item.id]}
                  onCheckedChange={(checked) =>
                    updateClientSettings({
                      sidebarThreadRowItems: setSidebarThreadRowItem(
                        getClientSettings(),
                        item,
                        checked,
                      ),
                    })
                  }
                >
                  {item.label}
                </MenuCheckboxItem>
              ))}
            </MenuGroup>
          </MenuPopup>
        </Menu>
      }
    />
  );
}
