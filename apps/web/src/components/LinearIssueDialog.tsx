import type { LinearIssueId } from "@t3tools/contracts";
import { useEffect, useId, useState } from "react";
import { create } from "zustand";

import { parseLinearIssueInput } from "../linearIssue";
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

/** undefined means the dialog was dismissed; null unlinks the issue. */
type Choice = LinearIssueId | null | undefined;
type Request = {
  readonly current: LinearIssueId | null;
  readonly resolve: (choice: Choice) => void;
};
const useRequest = create<{ request: Request | null }>(() => ({ request: null }));

export function requestLinearIssue(current: LinearIssueId | null): Promise<Choice> {
  useRequest.getState().request?.resolve(undefined);
  return new Promise((resolve) => useRequest.setState({ request: { current, resolve } }));
}

function finish(choice: Choice) {
  const request = useRequest.getState().request;
  useRequest.setState({ request: null });
  request?.resolve(choice);
}

export function LinearIssueDialogHost() {
  const request = useRequest((state) => state.request);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- resolves any pending request promise when the dialog host unmounts
  useEffect(() => () => finish(undefined), []);
  return request ? <LinearIssueDialog current={request.current} /> : null;
}

function LinearIssueDialog(props: { readonly current: LinearIssueId | null }) {
  const id = useId();
  const [text, setText] = useState(props.current ?? "");
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
            const issue = parseLinearIssueInput(text);
            if (issue === undefined) {
              setError("Enter an issue id like MB-123, or a Linear issue link.");
              return;
            }
            finish(issue);
          }}
        >
          <DialogHeader>
            <DialogTitle>Linear issue</DialogTitle>
            <DialogDescription>Link this thread to the Linear issue it works on.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-2">
              <Label htmlFor={id}>Issue id or link</Label>
              <Input
                id={id}
                autoFocus
                placeholder="MB-123"
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
            {props.current !== null && (
              <Button
                type="button"
                variant="ghost-muted"
                className="sm:mr-auto"
                onClick={() => finish(null)}
              >
                Unlink
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => finish(undefined)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
