import { ThreadTag } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useEffect, useId, useState } from "react";
import { create } from "zustand";

import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const isThreadTag = Schema.is(ThreadTag);

/** undefined means the dialog was dismissed. */
type Choice = ThreadTag | undefined;
type Request = { readonly resolve: (choice: Choice) => void };
const useRequest = create<{ request: Request | null }>(() => ({ request: null }));

export function requestThreadTag(): Promise<Choice> {
  useRequest.getState().request?.resolve(undefined);
  return new Promise((resolve) => useRequest.setState({ request: { resolve } }));
}

function finish(choice: Choice) {
  const request = useRequest.getState().request;
  useRequest.setState({ request: null });
  request?.resolve(choice);
}

export function ThreadTagDialogHost() {
  const request = useRequest((state) => state.request);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- resolves any pending request promise when the dialog host unmounts
  useEffect(() => () => finish(undefined), []);
  return request ? <ThreadTagDialog /> : null;
}

function ThreadTagDialog() {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finish(undefined);
      }}
    >
      <DialogPopup className="sm:max-w-sm">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            const tag = text.trim();
            if (!isThreadTag(tag)) {
              setError("Enter a single line of up to 64 characters.");
              return;
            }
            finish(tag);
          }}
        >
          <DialogHeader>
            <DialogTitle>New tag</DialogTitle>
            <DialogDescription>Add a tag to this thread.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-2">
              <Label htmlFor={id}>Tag</Label>
              <Input
                id={id}
                autoFocus
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setError(null);
                }}
              />
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(undefined)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
