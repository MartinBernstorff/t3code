import {
  MAX_CONTEXT_WINDOW_METER_CAP_TOKENS,
  MIN_CONTEXT_WINDOW_METER_CAP_TOKENS,
} from "@t3tools/contracts/settings";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import {
  getClientSettings,
  updateClientSettings,
  useClientSettings,
} from "../../hooks/useSettings";
import {
  COMPOSER_ITEMS,
  isDefaultComposerVisibility,
  resolveComposerVisibility,
  RESET_COMPOSER_ITEMS,
  setComposerItem,
} from "../chat/composerItems";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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

export function ComposerItemsRow() {
  const visibility = useClientSettings(resolveComposerVisibility);
  const capTokens = useClientSettings((settings) => settings.contextWindowMeterCapTokens);
  const enabled = COMPOSER_ITEMS.filter((item) => visibility[item.id]).length;
  return (
    <>
      <SettingsRow
        {...searchableSetting("composer-items")}
        description="Choose which controls the chat input shows."
        resetAction={
          isDefaultComposerVisibility(visibility) ? null : (
            <SettingResetButton
              label="composer controls"
              onClick={() => updateClientSettings(RESET_COMPOSER_ITEMS)}
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
                  aria-label={`Composer controls: ${enabled} of ${COMPOSER_ITEMS.length} on`}
                />
              }
            >
              {enabled} of {COMPOSER_ITEMS.length} on
              <ChevronDownIcon aria-hidden />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuGroup>
                <MenuGroupLabel>Show in the chat input</MenuGroupLabel>
                {COMPOSER_ITEMS.map((item) => (
                  <MenuCheckboxItem
                    key={item.id}
                    checked={visibility[item.id]}
                    onCheckedChange={(checked) =>
                      updateClientSettings({
                        composerItems: setComposerItem(getClientSettings(), item, checked),
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
      {visibility.context ? (
        <SettingsRow
          {...searchableSetting("context-window-meter-cap")}
          description="Thousands of tokens the context window indicator fills up to. Yellow from 75%, red when full."
          control={
            <ContextMeterCapInput
              value={capTokens}
              onCommit={(tokens) => updateClientSettings({ contextWindowMeterCapTokens: tokens })}
            />
          }
        />
      ) : null}
    </>
  );
}

const MIN_CONTEXT_METER_CAP_THOUSANDS = MIN_CONTEXT_WINDOW_METER_CAP_TOKENS / 1_000;
const MAX_CONTEXT_METER_CAP_THOUSANDS = MAX_CONTEXT_WINDOW_METER_CAP_TOKENS / 1_000;

function ContextMeterCapInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (tokens: number) => void;
}) {
  const thousands = String(value / 1_000);
  const [draft, setDraft] = useState(thousands);
  const [draftSource, setDraftSource] = useState(value);
  if (draftSource !== value) {
    setDraftSource(value);
    setDraft(thousands);
  }

  return (
    <Input
      size="sm"
      type="number"
      min={MIN_CONTEXT_METER_CAP_THOUSANDS}
      max={MAX_CONTEXT_METER_CAP_THOUSANDS}
      className="w-full sm:w-24"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = Number(event.target.value);
        if (
          Number.isInteger(parsed) &&
          parsed >= MIN_CONTEXT_METER_CAP_THOUSANDS &&
          parsed <= MAX_CONTEXT_METER_CAP_THOUSANDS
        ) {
          onCommit(parsed * 1_000);
        }
      }}
      onBlur={() => setDraft(thousands)}
      aria-label="Context window indicator cap in thousands of tokens"
    />
  );
}
