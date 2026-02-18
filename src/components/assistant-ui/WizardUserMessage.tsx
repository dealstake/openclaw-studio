"use client";

import { memo, type FC } from "react";
import { MessagePrimitive } from "@assistant-ui/react";

export const WizardUserMessage: FC = memo(function WizardUserMessage() {
  return (
    <MessagePrimitive.Root className="aui-user-message flex justify-end pb-3">
      <div className="max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-sm text-foreground">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
});
