/**
 * Template index — imports and registers all Starter Kit templates.
 * Import this module once at app startup to populate the registry.
 */

import { registerTemplate } from "../lib/templateRegistry";
import { coldCallerTemplate } from "./cold-caller/template";
import { executiveAssistantTemplate } from "./executive-assistant/template";

registerTemplate(executiveAssistantTemplate);
registerTemplate(coldCallerTemplate);
